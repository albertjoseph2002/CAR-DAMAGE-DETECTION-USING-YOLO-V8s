// Protect routes and check auth
const token = localStorage.getItem('admin_token');
if (!token && window.location.pathname !== '/admin/login' && window.location.pathname !== '/login') {
    window.location.href = '/login';
}

// Global state
let currentUsers = [];
let currentProjects = [];
let deleteTarget = null; // { type: 'user'|'project', id: string }

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/admin/dashboard') {
        initDashboard();
        setupEventListeners();
    }
});

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active state
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Switch section
            const targetId = item.getAttribute('data-target');
            document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            
            // Update title
            const titleMap = {
                'overview-section': 'Overview',
                'users-section': 'Users Management',
                'projects-section': 'Projects Management'
            };
            document.getElementById('pageTitle').innerText = titleMap[targetId];
            
            // Reload data if needed
            if(targetId === 'users-section') fetchUsers();
            if(targetId === 'projects-section') fetchProjects();
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
    });

    // Modals
    setupUserModal();
    setupProjectModal();
    setupDeleteModal();
}

async function apiFetch(endpoint, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    
    options.headers = { ...defaultHeaders, ...options.headers };
    
    const response = await fetch(endpoint, options);
    
    if (response.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
        throw new Error("Unauthorized");
    }
    
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "API Error");
    }
    
    return response.json();
}

async function initDashboard() {
    fetchMetrics();
    fetchUsers();
    fetchProjects();
}

async function fetchMetrics() {
    try {
        const data = await apiFetch('/api/admin/metrics');
        document.getElementById('totalUsersMetric').innerText = data.total_users;
        document.getElementById('totalProjectsMetric').innerText = data.total_projects;
    } catch (err) {
        console.error("Failed to fetch metrics", err);
    }
}

async function fetchUsers() {
    try {
        currentUsers = await apiFetch('/api/admin/users');
        renderUsersTable();
    } catch (err) {
        console.error("Failed to fetch users", err);
    }
}

async function fetchProjects() {
    try {
        currentProjects = await apiFetch('/api/admin/projects');
        renderProjectsTable();
    } catch (err) {
        console.error("Failed to fetch projects", err);
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    if (currentUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No users found</td></tr>';
        return;
    }
    
    currentUsers.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.first_name} ${user.last_name}</td>
            <td>${user.email}</td>
            <td class="action-btns">
                <button class="btn-sm" onclick="openEditUserModal('${user.id}')">Edit</button>
                <button class="btn-sm btn-danger" onclick="openDeleteModal('user', '${user.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderProjectsTable() {
    const tbody = document.getElementById('projectsTableBody');
    tbody.innerHTML = '';
    
    if (currentProjects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No projects found</td></tr>';
        return;
    }
    
    currentProjects.forEach(project => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${project.projectName || 'Unnamed Project'}</td>
            <td>${project.user_email}</td>
            <td>${project.year} ${project.make} ${project.model} <br><small style="color: #8b949e">${project.number_plate}</small></td>
            <td class="action-btns">
                <button class="btn-sm" onclick="openEditProjectModal('${project.id}')">Edit</button>
                <button class="btn-sm btn-danger" onclick="openDeleteModal('project', '${project.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// User Modal Logic
function setupUserModal() {
    const modal = document.getElementById('userModal');
    const closeBtns = [document.getElementById('closeUserModal'), document.getElementById('cancelUserModal')];
    const form = document.getElementById('userForm');
    
    document.getElementById('addUserBtn').addEventListener('click', () => {
        document.getElementById('userModalTitle').innerText = 'Add New User';
        form.reset();
        document.getElementById('userId').value = '';
        document.getElementById('passwordGroup').style.display = 'block';
        document.getElementById('userPassword').required = true;
        document.getElementById('userErrorMsg').style.display = 'none';
        modal.classList.add('active');
    });
    
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.remove('active')));
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('userId').value;
        const payload = {
            first_name: document.getElementById('firstName').value,
            last_name: document.getElementById('lastName').value,
            email: document.getElementById('userEmail').value
        };
        
        const isEditing = !!id;
        let endpoint = '/api/admin/users';
        let method = 'POST';
        
        if (isEditing) {
            endpoint += `/${id}`;
            method = 'PUT';
        } else {
            payload.password = document.getElementById('userPassword').value;
        }
        
        try {
            await apiFetch(endpoint, {
                method: method,
                body: JSON.stringify(payload)
            });
            modal.classList.remove('active');
            fetchUsers();
            fetchMetrics();
        } catch (err) {
            document.getElementById('userErrorMsg').innerText = err.message;
            document.getElementById('userErrorMsg').style.display = 'block';
        }
    });
}

window.openEditUserModal = (id) => {
    const user = currentUsers.find(u => u.id === id);
    if (!user) return;
    
    document.getElementById('userModalTitle').innerText = 'Edit User';
    document.getElementById('userId').value = user.id;
    document.getElementById('firstName').value = user.first_name;
    document.getElementById('lastName').value = user.last_name;
    document.getElementById('userEmail').value = user.email;
    
    // Hide password field when editing
    document.getElementById('passwordGroup').style.display = 'none';
    document.getElementById('userPassword').required = false;
    document.getElementById('userErrorMsg').style.display = 'none';
    
    document.getElementById('userModal').classList.add('active');
};

// Project Modal Logic
function setupProjectModal() {
    const modal = document.getElementById('projectModal');
    const closeBtns = [document.getElementById('closeProjectModal'), document.getElementById('cancelProjectModal')];
    const form = document.getElementById('projectForm');
    
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.remove('active')));
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('editProjectId').value;
        const payload = {
            projectName: document.getElementById('editProjectName').value,
            year: document.getElementById('editProjectYear').value,
            make: document.getElementById('editProjectMake').value,
            model: document.getElementById('editProjectModel').value,
            number_plate: document.getElementById('editProjectNumberPlate').value
        };
        
        try {
            await apiFetch(`/api/admin/projects/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            modal.classList.remove('active');
            fetchProjects();
        } catch (err) {
            document.getElementById('projectErrorMsg').innerText = err.message;
            document.getElementById('projectErrorMsg').style.display = 'block';
        }
    });
}

window.openEditProjectModal = (id) => {
    const project = currentProjects.find(p => p.id === id);
    if (!project) return;
    
    document.getElementById('editProjectId').value = project.id;
    document.getElementById('editProjectName').value = project.projectName || '';
    document.getElementById('editProjectYear').value = project.year || '';
    document.getElementById('editProjectMake').value = project.make || '';
    document.getElementById('editProjectModel').value = project.model || '';
    document.getElementById('editProjectNumberPlate').value = project.number_plate || '';
    
    document.getElementById('projectErrorMsg').style.display = 'none';
    document.getElementById('projectModal').classList.add('active');
};

// Delete Modal Logic
function setupDeleteModal() {
    const modal = document.getElementById('deleteModal');
    const closeBtns = [document.getElementById('closeDeleteModal'), document.getElementById('cancelDeleteModal')];
    
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.remove('active')));
    
    document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
        if (!deleteTarget) return;
        
        try {
            if (deleteTarget.type === 'user') {
                await apiFetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
                fetchUsers();
                fetchProjects();
            } else if (deleteTarget.type === 'project') {
                await apiFetch(`/api/admin/projects/${deleteTarget.id}`, { method: 'DELETE' });
                fetchProjects();
            }
            fetchMetrics();
            modal.classList.remove('active');
        } catch (err) {
            alert('Failed to delete: ' + err.message);
        }
    });
}

window.openDeleteModal = (type, id) => {
    deleteTarget = { type, id };
    const modal = document.getElementById('deleteModal');
    
    if (type === 'user') {
        document.getElementById('deleteMessage').innerText = "Are you sure you want to delete this user? ALL of their projects will also be permanently deleted.";
    } else {
        document.getElementById('deleteMessage').innerText = "Are you sure you want to delete this project? This action cannot be undone.";
    }
    
    modal.classList.add('active');
};
