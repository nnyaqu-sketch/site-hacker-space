// Profile Page
let selectedColor = '#c7d2fe';

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await checkAuth();
    if (!auth.loggedIn) {
        window.location.href = '/login.html';
        return;
    }

    await loadProfile();
    setupEventListeners();
});

async function loadProfile() {
    try {
        const res = await fetch('/api/profile');
        const profile = await res.json();
        
        // Populate form
        document.getElementById('display-name').value = profile.display_name || me.username;
        document.getElementById('bio').value = profile.bio || '';
        document.getElementById('profile-public').checked = profile.is_public !== false;
        document.getElementById('show-stats').checked = profile.show_stats !== false;
        
        selectedColor = profile.avatar_color || '#c7d2fe';
        updateColorSelection();
        updatePreview();
        
        // Update stats
        document.getElementById('preview-messages').textContent = profile.message_count || 0;
        if (profile.created_at) {
            const joinDate = new Date(profile.created_at);
            document.getElementById('preview-joined').textContent = joinDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        }
    } catch (err) {
        console.error('Failed to load profile:', err);
        // Use defaults
        document.getElementById('display-name').value = me.username;
        updatePreview();
    }
}

function setupEventListeners() {
    const displayNameInput = document.getElementById('display-name');
    const bioInput = document.getElementById('bio');
    const bioCount = document.getElementById('bio-count');
    const profileForm = document.getElementById('profile-form');
    const colorOptions = document.querySelectorAll('.color-option');

    // Update preview on input
    displayNameInput.addEventListener('input', updatePreview);
    bioInput.addEventListener('input', () => {
        bioCount.textContent = `${bioInput.value.length}/200 caractères`;
        updatePreview();
    });

    // Color picker
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            selectedColor = option.dataset.color;
            updateColorSelection();
            updatePreview();
        });
    });

    // Form submission
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProfile();
    });
}

function updateColorSelection() {
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.color === selectedColor) {
            option.classList.add('selected');
        }
    });
}

function updatePreview() {
    const displayName = document.getElementById('display-name').value || me.username;
    const bio = document.getElementById('bio').value || 'Votre biographie apparaîtra ici...';
    
    // Update avatar
    const initials = displayName.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
    const previewAvatar = document.getElementById('preview-avatar');
    previewAvatar.textContent = initials;
    
    // Get the gradient from the selected color option
    const selectedOption = document.querySelector(`.color-option[data-color="${selectedColor}"]`);
    if (selectedOption) {
        previewAvatar.style.background = selectedOption.style.background;
    }
    
    // Update text
    document.getElementById('preview-display-name').textContent = displayName;
    document.getElementById('preview-username').textContent = `@${me.username}`;
    document.getElementById('preview-bio').textContent = bio;
    
    // Update role
    const roleText = me.role === 'admin' ? 'Administrateur' : me.role === 'creator' ? 'Créateur' : 'Membre';
    document.getElementById('preview-role').textContent = roleText;
}

async function saveProfile() {
    const profileData = {
        display_name: document.getElementById('display-name').value.trim() || me.username,
        bio: document.getElementById('bio').value.trim(),
        avatar_color: selectedColor,
        is_public: document.getElementById('profile-public').checked,
        show_stats: document.getElementById('show-stats').checked
    };

    try {
        const res = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });

        if (res.ok) {
            alert('Profil enregistré avec succès!');
        } else {
            throw new Error('Failed to save profile');
        }
    } catch (err) {
        console.error('Failed to save profile:', err);
        alert('Erreur lors de l\'enregistrement du profil');
    }
}