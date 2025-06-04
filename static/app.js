// Global state
let currentPath = '';
let selectedItem = null;
let selectedItemType = null;
let currentUser = null;

// DOM elements
const fileGrid = document.getElementById('fileGrid');
const breadcrumb = document.getElementById('breadcrumb');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const uploadModal = document.getElementById('uploadModal');
const folderModal = document.getElementById('folderModal');
const contextMenu = document.getElementById('contextMenu');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (response.ok && data.authenticated) {
            currentUser = data.user;
            document.getElementById('userInfo').textContent = `Welcome, ${currentUser.username}`;
            loadFiles();
        } else {
            // User not authenticated, redirect to login
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        // Error checking auth, redirect to login
        window.location.href = '/login.html';
    }
}

// Event listeners
function setupEventListeners() {
    // Upload button
    document.getElementById('uploadBtn').addEventListener('click', () => {
        uploadModal.classList.remove('hidden');
    });

    // New folder button
    document.getElementById('newFolderBtn').addEventListener('click', () => {
        folderModal.classList.remove('hidden');
        document.getElementById('folderNameInput').focus();
    });

    // Close modals
    document.getElementById('closeUploadModal').addEventListener('click', () => {
        uploadModal.classList.add('hidden');
    });

    document.getElementById('closeFolderModal').addEventListener('click', () => {
        folderModal.classList.add('hidden');
    });

    document.getElementById('cancelFolderBtn').addEventListener('click', () => {
        folderModal.classList.add('hidden');
    });

    // File input
    document.getElementById('selectFilesBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', handleFileUpload);

    // Create folder
    document.getElementById('createFolderBtn').addEventListener('click', createFolder);
    document.getElementById('folderNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createFolder();
    });    // Context menu actions
    document.getElementById('downloadItem').addEventListener('click', downloadSelectedItem);
    document.getElementById('renameItem').addEventListener('click', renameSelectedItem);
    document.getElementById('deleteItem').addEventListener('click', deleteSelectedItem);

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Close context menu when clicking elsewhere
    document.addEventListener('click', () => {
        contextMenu.classList.add('hidden');
    });

    // Drag and drop
    const dropZone = uploadModal.querySelector('.border-dashed');
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500', 'bg-blue-50');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        const files = Array.from(e.dataTransfer.files);
        uploadFiles(files);
    });
}

// Load files and folders
async function loadFiles(path = '') {
    loading.classList.remove('hidden');
    fileGrid.innerHTML = '';
    emptyState.classList.add('hidden');

    try {
        const response = await apiCall(`/api/browse?path=${encodeURIComponent(path)}`);
        if (!response) return; // Redirected to login
        
        const data = await response.json();

        currentPath = path;
        updateBreadcrumb(path);

        if (data.folders.length === 0 && data.files.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            renderItems(data.folders, data.files);
        }
    } catch (error) {
        console.error('Error loading files:', error);
        showNotification('Error loading files', 'error');
    } finally {
        loading.classList.add('hidden');
    }
}

// Render files and folders
function renderItems(folders, files) {
    fileGrid.innerHTML = '';

    // Render folders
    folders.forEach(folder => {
        const folderElement = createFolderElement(folder);
        fileGrid.appendChild(folderElement);
    });

    // Render files
    files.forEach(file => {
        const fileElement = createFileElement(file);
        fileGrid.appendChild(fileElement);
    });
}

// Create folder element
function createFolderElement(folder) {
    const div = document.createElement('div');
    div.className = 'p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors';
    div.innerHTML = `
        <div class="flex flex-col items-center text-center">
            <i class="fas fa-folder text-blue-500 text-3xl mb-2"></i>
            <span class="text-sm font-medium text-gray-900 truncate w-full">${folder.name}</span>
            <span class="text-xs text-gray-500 mt-1">${new Date(folder.created_at).toLocaleDateString()}</span>
        </div>
    `;

    div.addEventListener('dblclick', () => {
        navigateToPath(folder.path);
    });

    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        selectedItem = folder;
        selectedItemType = 'folder';
        showContextMenu(e.pageX, e.pageY);
    });

    return div;
}

// Create file element
function createFileElement(file) {
    const div = document.createElement('div');
    div.className = 'p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors';
    
    const fileIcon = getFileIcon(file.mime_type);
    const fileSize = formatFileSize(file.file_size);

    div.innerHTML = `
        <div class="flex flex-col items-center text-center">
            <i class="${fileIcon} text-3xl mb-2"></i>
            <span class="text-sm font-medium text-gray-900 truncate w-full">${file.original_name}</span>
            <span class="text-xs text-gray-500 mt-1">${fileSize}</span>
        </div>
    `;

    div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        selectedItem = file;
        selectedItemType = 'file';
        showContextMenu(e.pageX, e.pageY);
    });

    return div;
}

// Get file icon based on mime type
function getFileIcon(mimeType) {
    if (!mimeType) return 'fas fa-file text-gray-500';
    
    if (mimeType.startsWith('image/')) return 'fas fa-file-image text-green-500';
    if (mimeType.startsWith('video/')) return 'fas fa-file-video text-red-500';
    if (mimeType.startsWith('audio/')) return 'fas fa-file-audio text-purple-500';
    if (mimeType.includes('pdf')) return 'fas fa-file-pdf text-red-600';
    if (mimeType.includes('word')) return 'fas fa-file-word text-blue-600';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel text-green-600';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fas fa-file-powerpoint text-orange-600';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'fas fa-file-archive text-yellow-600';
    
    return 'fas fa-file text-gray-500';
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Update breadcrumb
function updateBreadcrumb(path) {
    breadcrumb.innerHTML = `
        <i class="fas fa-home"></i>
        <span class="cursor-pointer hover:text-blue-600" onclick="navigateToPath('')">Home</span>
    `;

    if (path) {
        const parts = path.split('/');
        let currentPath = '';
        
        parts.forEach((part, index) => {
            currentPath += (index === 0 ? '' : '/') + part;
            breadcrumb.innerHTML += `
                <i class="fas fa-chevron-right text-gray-400"></i>
                <span class="cursor-pointer hover:text-blue-600" onclick="navigateToPath('${currentPath}')">${part}</span>
            `;
        });
    }
}

// Navigate to path
function navigateToPath(path) {
    loadFiles(path);
}

// Handle file upload
function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    uploadFiles(files);
}

// Upload files
async function uploadFiles(files) {
    if (files.length === 0) return;

    const progressContainer = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    progressContainer.classList.remove('hidden');

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        try {
            progressText.textContent = `Uploading ${file.name} (${i + 1}/${files.length})...`;
            progressBar.style.width = `${((i + 1) / files.length) * 100}%`;

            const response = await fetch(`/api/upload?path=${encodeURIComponent(currentPath)}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Failed to upload ${file.name}`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            showNotification(`Failed to upload ${file.name}`, 'error');
        }
    }

    progressContainer.classList.add('hidden');
    uploadModal.classList.add('hidden');
    document.getElementById('fileInput').value = '';
    
    showNotification('Files uploaded successfully', 'success');
    loadFiles(currentPath);
}

// Create folder
async function createFolder() {
    const name = document.getElementById('folderNameInput').value.trim();
    if (!name) return;

    try {
        const response = await fetch('/api/folder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                path: currentPath
            })
        });

        if (response.ok) {
            folderModal.classList.add('hidden');
            document.getElementById('folderNameInput').value = '';
            showNotification('Folder created successfully', 'success');
            loadFiles(currentPath);
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to create folder', 'error');
        }
    } catch (error) {
        console.error('Error creating folder:', error);
        showNotification('Failed to create folder', 'error');
    }
}

// Show context menu
function showContextMenu(x, y) {
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.classList.remove('hidden');

    // Hide download option for folders
    document.getElementById('downloadItem').style.display = 
        selectedItemType === 'file' ? 'block' : 'none';
}

// Download selected item
function downloadSelectedItem() {
    if (selectedItem && selectedItemType === 'file') {
        window.open(`/api/file/${selectedItem.id}/download`, '_blank');
    }
    contextMenu.classList.add('hidden');
}

// Delete selected item
async function deleteSelectedItem() {
    if (!selectedItem) return;

    const itemName = selectedItem.name || selectedItem.original_name;
    if (!confirm(`Are you sure you want to delete "${itemName}"?`)) {
        contextMenu.classList.add('hidden');
        return;
    }

    try {
        const endpoint = selectedItemType === 'file' 
            ? `/api/file/${selectedItem.id}`
            : `/api/folder/${selectedItem.id}`;

        const response = await fetch(endpoint, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('Item deleted successfully', 'success');
            loadFiles(currentPath);
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to delete item', 'error');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        showNotification('Failed to delete item', 'error');
    }

    contextMenu.classList.add('hidden');
}

// Rename selected item
async function renameSelectedItem() {
    if (!selectedItem) return;

    const currentName = selectedItem.name || selectedItem.original_name;
    const newName = prompt(`Rename "${currentName}" to:`, currentName);
    
    if (!newName || newName === currentName) {
        contextMenu.classList.add('hidden');
        return;
    }

    try {
        const endpoint = selectedItemType === 'file' 
            ? `/api/file/${selectedItem.id}/rename`
            : `/api/folder/${selectedItem.id}`;

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });

        if (response.ok) {
            showNotification('Item renamed successfully', 'success');
            loadFiles(currentPath);
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to rename item', 'error');
        }
    } catch (error) {
        console.error('Error renaming item:', error);
        showNotification('Failed to rename item', 'error');
    }

    contextMenu.classList.add('hidden');
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Handle logout
async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login.html';
    }
}

// Global error handler for API calls
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, options);
        
        if (response.status === 401) {
            // Unauthorized, redirect to login
            window.location.href = '/login.html';
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}
