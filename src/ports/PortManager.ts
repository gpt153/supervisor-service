import db from '../db/pool.js';

export interface PortRange {
  id: number;
  projectId: number;
  projectName: string;
  portRangeStart: number;
  portRangeEnd: number;
  createdAt: Date;
}

export interface PortAllocation {
  id: number;
  projectId: number;
  port: number;
  serviceName: string;
  description?: string;
  cloudflareHostname?: string;
  allocatedAt: Date;
  allocatedBy?: string;
  status: 'active' | 'released';
}

export class PortManager {
  /**
   * Create a new port range for a project
   */
  async createPortRange(projectName: string): Promise<PortRange> {
    // Get next available project ID
    const nextIdResult = await db.query<{ get_next_project_id: number }>(
      `SELECT get_next_project_id() as get_next_project_id`
    );
    const projectId = nextIdResult.rows[0].get_next_project_id;

    // Calculate port range start (each project gets 100 ports)
    const portRangeStart = 3000 + projectId * 100;
    const portRangeEnd = portRangeStart + 99;

    // Ensure we don't exceed valid port range
    if (portRangeEnd > 65435) {
      throw new Error('No more port ranges available (maximum capacity reached)');
    }

    const result = await db.query<PortRange>(
      `INSERT INTO project_port_ranges (project_id, project_name, port_range_start, port_range_end)
       VALUES ($1, $2, $3, $4)
       RETURNING id, project_id, project_name, port_range_start, port_range_end, created_at`,
      [projectId, projectName, portRangeStart, portRangeEnd]
    );

    return result.rows[0];
  }

  /**
   * Get port range for a project
   */
  async getPortRange(projectName: string): Promise<PortRange | null> {
    const result = await db.query<PortRange>(
      `SELECT id, project_id, project_name, port_range_start, port_range_end, created_at
       FROM project_port_ranges
       WHERE project_name = $1`,
      [projectName]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * List all port ranges
   */
  async listPortRanges(): Promise<PortRange[]> {
    const result = await db.query<PortRange>(
      `SELECT id, project_id, project_name, port_range_start, port_range_end, created_at
       FROM project_port_ranges
       ORDER BY project_id`
    );

    return result.rows;
  }

  /**
   * Allocate next available port for a project
   */
  async allocatePort(
    projectName: string,
    serviceName: string,
    options?: {
      description?: string;
      cloudflareHostname?: string;
      allocatedBy?: string;
    }
  ): Promise<PortAllocation> {
    // Get project's port range
    const portRange = await this.getPortRange(projectName);
    if (!portRange) {
      throw new Error(`No port range found for project: ${projectName}`);
    }

    // Use database function to allocate next available port
    const result = await db.query<{ allocate_next_port: number }>(
      `SELECT allocate_next_port($1, $2, $3, $4) as allocate_next_port`,
      [portRange.projectId, serviceName, options?.description, options?.cloudflareHostname]
    );

    const port = result.rows[0].allocate_next_port;

    // Return the allocation details
    const allocation = await this.getPort(port);
    if (!allocation) {
      throw new Error(`Failed to retrieve allocation for port ${port}`);
    }
    return allocation;
  }

  /**
   * Allocate specific port for a project
   */
  async allocateSpecificPort(
    projectName: string,
    port: number,
    serviceName: string,
    options?: {
      description?: string;
      cloudflareHostname?: string;
      allocatedBy?: string;
    }
  ): Promise<PortAllocation> {
    // Get project's port range
    const portRange = await this.getPortRange(projectName);
    if (!portRange) {
      throw new Error(`No port range found for project: ${projectName}`);
    }

    // Verify port is within range
    if (port < portRange.portRangeStart || port > portRange.portRangeEnd) {
      throw new Error(
        `Port ${port} is outside project ${projectName} range (${portRange.portRangeStart}-${portRange.portRangeEnd})`
      );
    }

    // Check if port is already allocated
    const existing = await this.getPort(port);
    if (existing && existing.status === 'active') {
      throw new Error(`Port ${port} is already allocated to ${existing.serviceName}`);
    }

    // Allocate the port
    const result = await db.query<PortAllocation>(
      `INSERT INTO port_allocations (project_id, port, service_name, description, cloudflare_hostname, allocated_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING id, project_id, port, service_name, description, cloudflare_hostname, allocated_at, allocated_by, status`,
      [
        portRange.projectId,
        port,
        serviceName,
        options?.description,
        options?.cloudflareHostname,
        options?.allocatedBy,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get port allocation details
   */
  async getPort(port: number): Promise<PortAllocation | null> {
    const result = await db.query<PortAllocation>(
      `SELECT id, project_id, port, service_name, description, cloudflare_hostname, allocated_at, allocated_by, status
       FROM port_allocations
       WHERE port = $1`,
      [port]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * List all port allocations for a project
   */
  async listAllocations(projectName?: string, includeReleased = false): Promise<PortAllocation[]> {
    let query = `SELECT pa.id, pa.project_id, pa.port, pa.service_name, pa.description,
                        pa.cloudflare_hostname, pa.allocated_at, pa.allocated_by, pa.status
                 FROM port_allocations pa`;

    const params: any[] = [];

    if (projectName) {
      query += `
        JOIN project_port_ranges ppr ON pa.project_id = ppr.project_id
        WHERE ppr.project_name = $1`;
      params.push(projectName);

      if (!includeReleased) {
        query += ` AND pa.status = 'active'`;
      }
    } else if (!includeReleased) {
      query += ` WHERE pa.status = 'active'`;
    }

    query += ` ORDER BY pa.port`;

    const result = await db.query<PortAllocation>(query, params);
    return result.rows;
  }

  /**
   * Release a port (mark as released, not delete)
   */
  async releasePort(port: number): Promise<boolean> {
    const result = await db.query(
      `UPDATE port_allocations
       SET status = 'released'
       WHERE port = $1 AND status = 'active'`,
      [port]
    );

    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Get available ports for a project
   */
  async getAvailablePorts(projectName: string): Promise<number[]> {
    const result = await db.query<{ port: number }>(
      `SELECT port
       FROM available_ports
       WHERE project_name = $1
       ORDER BY port`,
      [projectName]
    );

    return result.rows.map((row) => row.port);
  }

  /**
   * Check if a port is available
   */
  async isPortAvailable(port: number): Promise<boolean> {
    const allocation = await this.getPort(port);
    return !allocation || allocation.status === 'released';
  }

  /**
   * Update port allocation metadata
   */
  async updatePort(
    port: number,
    updates: {
      serviceName?: string;
      description?: string;
      cloudflareHostname?: string;
    }
  ): Promise<PortAllocation | null> {
    const updateFields: string[] = [];
    const params: any[] = [port];
    let paramIndex = 2;

    if (updates.serviceName !== undefined) {
      updateFields.push(`service_name = $${paramIndex++}`);
      params.push(updates.serviceName);
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }

    if (updates.cloudflareHostname !== undefined) {
      updateFields.push(`cloudflare_hostname = $${paramIndex++}`);
      params.push(updates.cloudflareHostname);
    }

    if (updateFields.length === 0) {
      return null;
    }

    const result = await db.query<PortAllocation>(
      `UPDATE port_allocations
       SET ${updateFields.join(', ')}
       WHERE port = $1
       RETURNING id, project_id, port, service_name, description, cloudflare_hostname, allocated_at, allocated_by, status`,
      params
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get port utilization statistics for a project
   */
  async getUtilization(projectName: string): Promise<{
    total: number;
    allocated: number;
    available: number;
    utilizationPercent: number;
  }> {
    const portRange = await this.getPortRange(projectName);
    if (!portRange) {
      throw new Error(`No port range found for project: ${projectName}`);
    }

    const allocations = await this.listAllocations(projectName, false);

    const total = 100; // Each project gets 100 ports
    const allocated = allocations.length;
    const available = total - allocated;
    const utilizationPercent = (allocated / total) * 100;

    return {
      total,
      allocated,
      available,
      utilizationPercent,
    };
  }
}
