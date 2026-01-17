const API_BASE = '/api';

async function init() {
    await Promise.all([
        loadProjects(),
        loadActivity()
    ]);
    setupEventSource();
}

async function loadProjects() {
    try {
        const response = await fetch(API_BASE + '/projects');
        if (!response.ok) throw new Error('Failed to fetch projects');
        
        const projects = await response.json();
        renderProjects(projects);
        updateStats(projects);
    } catch (error) {
        showError('Failed to load projects: ' + error.message);
    }
}

function renderProjects(projects) {
    const grid = document.getElementById('projects-grid');
    
    if (projects.length === 0) {
        grid.innerHTML = '<div class="loading">No projects found</div>';
        return;
    }
    
    const html = projects.map(project => {
        const statusBadge = project.sessionActive ? 
            '<span class="status-badge status-active">Active</span>' : 
            '<span class="status-badge status-inactive">Inactive</span>';
        
        const sessionId = project.sessionId ? project.sessionId.substring(0, 8) + '...' : 'None';
        const issueCount = project.issueCount || 0;
        const lastActive = formatDate(project.lastActive);
        
        return '<div class="project-card">' +
            '<div class="project-header">' +
            '<div class="project-name">' + project.name + '</div>' +
            '<div class="project-status">' + statusBadge + '</div>' +
            '</div>' +
            '<div class="project-body">' +
            '<div class="project-info">' +
            '<div class="info-row">' +
            '<span class="info-label">Last Active:</span>' +
            '<span class="info-value">' + lastActive + '</span>' +
            '</div>' +
            '<div class="info-row">' +
            '<span class="info-label">Open Issues:</span>' +
            '<span class="info-value">' + issueCount + '</span>' +
            '</div>' +
            '<div class="info-row">' +
            '<span class="info-label">Session ID:</span>' +
            '<span class="info-value">' + sessionId + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="project-actions">' +
            '<button class="btn-primary" onclick="viewProject(\'' + project.name + '\')">View</button>' +
            '<button class="btn-success" onclick="verifyProject(\'' + project.name + '\')">Verify</button>' +
            '<button class="btn-secondary" onclick="refreshProject(\'' + project.name + '\')">Refresh</button>' +
            '</div>' +
            '</div>' +
            '</div>';
    });
    
    grid.innerHTML = html.join('');
}

function updateStats(projects) {
    document.getElementById('total-projects').textContent = projects.length;
    document.getElementById('active-sessions').textContent = 
        projects.filter(p => p.sessionActive).length;
    document.getElementById('total-issues').textContent = 
        projects.reduce((sum, p) => sum + (p.issueCount || 0), 0);
}

async function loadActivity() {
    try {
        const response = await fetch(API_BASE + '/activity');
        if (!response.ok) throw new Error('Failed to fetch activity');
        
        const activities = await response.json();
        renderActivity(activities);
    } catch (error) {
        showError('Failed to load activity: ' + error.message);
    }
}

function renderActivity(activities) {
    const list = document.getElementById('activity-list');
    
    if (activities.length === 0) {
        list.innerHTML = '<div class="loading">No recent activity</div>';
        return;
    }
    
    const html = activities.map(activity => 
        '<div class="activity-item">' +
        '<div class="activity-time">' + formatDate(activity.timestamp) + '</div>' +
        '<div class="activity-message">' + activity.message + '</div>' +
        '</div>'
    );
    
    list.innerHTML = html.join('');
}

function setupEventSource() {
    const eventSource = new EventSource(API_BASE + '/events');
    
    eventSource.addEventListener('project-update', (event) => {
        const data = JSON.parse(event.data);
        console.log('Project update:', data);
        loadProjects();
    });
    
    eventSource.addEventListener('activity', (event) => {
        const data = JSON.parse(event.data);
        console.log('New activity:', data);
        loadActivity();
    });
    
    eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        setTimeout(setupEventSource, 5000);
    };
}

async function viewProject(projectName) {
    try {
        const response = await fetch(API_BASE + '/projects/' + projectName + '/status');
        if (!response.ok) throw new Error('Failed to fetch project status');
        
        const status = await response.json();
        alert(JSON.stringify(status, null, 2));
    } catch (error) {
        showError('Failed to view project: ' + error.message);
    }
}

async function verifyProject(projectName) {
    if (!confirm('Verify all SCAR work for ' + projectName + '?')) return;
    
    try {
        const response = await fetch(API_BASE + '/projects/' + projectName + '/verify', {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to trigger verification');
        
        const result = await response.json();
        alert('Verification started: ' + result.message);
        loadActivity();
    } catch (error) {
        showError('Failed to verify project: ' + error.message);
    }
}

async function refreshProject(projectName) {
    await loadProjects();
}

function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function showError(message) {
    const container = document.getElementById('error-container');
    container.innerHTML = '<div class="error">' + message + '</div>';
    setTimeout(() => container.innerHTML = '', 5000);
}

init();
setInterval(() => {
    loadProjects();
    loadActivity();
}, 30000);
