import db from '../db/pool.js';

export interface TaskExecution {
  id: number;
  taskId: string;
  taskType: string;
  taskDescription: string;
  startedAt: Date;
  completedAt?: Date;
  durationSeconds?: number;
  estimatedSeconds?: number;
  estimationError?: number;
  projectName?: string;
  epicId?: string;
  issueNumber?: number;
  modelUsed?: string;
  complexity?: 'simple' | 'moderate' | 'complex';
  filesChanged?: number;
  linesChanged?: number;
  parallelExecution?: boolean;
  parentTaskId?: string;
  status: 'running' | 'completed' | 'failed';
  errorMessage?: string;
}

export interface TaskStats {
  taskType: string;
  projectName?: string;
  totalExecutions: number;
  avgDuration: number;
  stddevDuration: number;
  avgEstimationError: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
}

export class TaskTimer {
  /**
   * Start timing a task
   */
  async startTask(
    taskId: string,
    taskType: string,
    taskDescription: string,
    options?: {
      estimatedSeconds?: number;
      projectName?: string;
      epicId?: string;
      issueNumber?: number;
      modelUsed?: string;
      complexity?: 'simple' | 'moderate' | 'complex';
      parallelExecution?: boolean;
      parentTaskId?: string;
    }
  ): Promise<TaskExecution> {
    const result = await db.query<TaskExecution>(
      `INSERT INTO task_executions (
        task_id, task_type, task_description, started_at, estimated_seconds,
        project_name, epic_id, issue_number, model_used, complexity,
        parallel_execution, parent_task_id, status
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, 'running')
      RETURNING *`,
      [
        taskId,
        taskType,
        taskDescription,
        options?.estimatedSeconds,
        options?.projectName,
        options?.epicId,
        options?.issueNumber,
        options?.modelUsed,
        options?.complexity,
        options?.parallelExecution,
        options?.parentTaskId,
      ]
    );

    return result.rows[0];
  }

  /**
   * Complete a task with success
   */
  async completeTask(
    taskId: string,
    metadata?: {
      filesChanged?: number;
      linesChanged?: number;
    }
  ): Promise<TaskExecution | null> {
    await db.query(
      `SELECT complete_task_execution($1, 'completed', NULL)`,
      [taskId]
    );

    if (metadata) {
      await db.query(
        `UPDATE task_executions
         SET files_changed = $2, lines_changed = $3
         WHERE task_id = $1`,
        [taskId, metadata.filesChanged, metadata.linesChanged]
      );
    }

    return this.getTask(taskId);
  }

  /**
   * Fail a task with error message
   */
  async failTask(taskId: string, errorMessage: string): Promise<TaskExecution | null> {
    await db.query(
      `SELECT complete_task_execution($1, 'failed', $2)`,
      [taskId, errorMessage]
    );

    return this.getTask(taskId);
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<TaskExecution | null> {
    const result = await db.query<TaskExecution>(
      `SELECT * FROM task_executions WHERE task_id = $1`,
      [taskId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * List tasks with optional filters
   */
  async listTasks(filter?: {
    projectName?: string;
    taskType?: string;
    status?: 'running' | 'completed' | 'failed';
    limit?: number;
  }): Promise<TaskExecution[]> {
    let query = `SELECT * FROM task_executions WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filter?.projectName) {
      params.push(filter.projectName);
      query += ` AND project_name = $${paramIndex++}`;
    }

    if (filter?.taskType) {
      params.push(filter.taskType);
      query += ` AND task_type = $${paramIndex++}`;
    }

    if (filter?.status) {
      params.push(filter.status);
      query += ` AND status = $${paramIndex++}`;
    }

    query += ` ORDER BY started_at DESC`;

    if (filter?.limit) {
      params.push(filter.limit);
      query += ` LIMIT $${paramIndex++}`;
    }

    const result = await db.query<TaskExecution>(query, params);
    return result.rows;
  }

  /**
   * Get statistics for a task type
   */
  async getStats(filter?: {
    taskType?: string;
    projectName?: string;
  }): Promise<TaskStats[]> {
    let query = `SELECT * FROM task_execution_stats WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filter?.taskType) {
      params.push(filter.taskType);
      query += ` AND task_type = $${paramIndex++}`;
    }

    if (filter?.projectName) {
      params.push(filter.projectName);
      query += ` AND project_name = $${paramIndex++}`;
    }

    query += ` ORDER BY total_executions DESC`;

    const result = await db.query<TaskStats>(query, params);
    return result.rows;
  }

  /**
   * Get estimated duration for a task type based on historical data
   */
  async getEstimatedDuration(
    taskType: string,
    complexity?: 'simple' | 'moderate' | 'complex'
  ): Promise<number | null> {
    let query = `
      SELECT AVG(duration_seconds)::INTEGER as avg_duration
      FROM task_executions
      WHERE task_type = $1
      AND status = 'completed'
    `;
    const params: any[] = [taskType];

    if (complexity) {
      params.push(complexity);
      query += ` AND complexity = $2`;
    }

    const result = await db.query<{ avg_duration: number }>(query, params);

    if (result.rows.length > 0 && result.rows[0].avg_duration) {
      return result.rows[0].avg_duration;
    }

    return null;
  }

  /**
   * Search tasks by description
   */
  async searchTasks(searchQuery: string, limit = 50): Promise<TaskExecution[]> {
    const result = await db.query<TaskExecution>(
      `SELECT *, ts_rank(to_tsvector('english', task_description), plainto_tsquery('english', $1)) AS rank
       FROM task_executions
       WHERE to_tsvector('english', task_description) @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC, started_at DESC
       LIMIT $2`,
      [searchQuery, limit]
    );

    return result.rows;
  }

  /**
   * Get running tasks
   */
  async getRunningTasks(): Promise<TaskExecution[]> {
    const result = await db.query<TaskExecution>(
      `SELECT * FROM task_executions
       WHERE status = 'running'
       ORDER BY started_at DESC`
    );

    return result.rows;
  }

  /**
   * Delete old completed tasks (cleanup)
   */
  async cleanupOldTasks(daysToKeep = 90): Promise<number> {
    const result = await db.query(
      `DELETE FROM task_executions
       WHERE status IN ('completed', 'failed')
       AND completed_at < NOW() - INTERVAL '${daysToKeep} days'`
    );

    return result.rowCount || 0;
  }
}
