async function loadLists() {
  const authResult = await checkAuth();
  if (!authResult.loggedIn) {
    document.getElementById('lists').innerHTML = '<div class="login-prompt">Veuillez vous connecter pour voir les listes</div>';
    window.location.href = '/login.html';
    return;
  }

  const res = await fetch('/api/checklists');
  const lists = await res.json();
  const container = document.getElementById('lists');
  container.innerHTML = '';
  
  lists.forEach(l => {
    const el = document.createElement('div');
    el.className = 'checklist';
    el.innerHTML = `
      <div class="list-header">
        <h3>${escapeHtml(l.name)}</h3>
        ${me.role === 'admin' || me.role === 'creator' || l.created_by === me.userId 
          ? `<button class="danger small delete-list" data-id="${l.id}">Delete</button>` 
          : ''}
      </div>
      <p>${escapeHtml(l.description || '')}</p>
    `;

    const ul = document.createElement('ul');
    ul.className = 'checklist-items';
    
    l.items.forEach(it => {
      const li = document.createElement('li');
      li.innerHTML = `
        <label class="checkbox">
          <input type="checkbox" data-id="${it.id}" ${it.checked ? 'checked' : ''}>
          <span class="checkmark"></span>
          ${escapeHtml(it.text)}
        </label>
      `;
      ul.appendChild(li);
    });
    
    el.appendChild(ul);

    const addRow = document.createElement('div');
    addRow.className = 'add-item-row';
    const addInput = document.createElement('input');
    addInput.placeholder = 'Add item';
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.className = 'secondary small';
    
    addBtn.addEventListener('click', async () => {
      const text = addInput.value.trim();
      if (!text) return;
      await fetch(`/api/checklist/${l.id}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text })
      });
      addInput.value = '';
      loadLists();
    });

    addRow.appendChild(addInput);
    addRow.appendChild(addBtn);
    el.appendChild(addRow);
    container.appendChild(el);
  });

  // Setup delete handlers
  document.querySelectorAll('.delete-list').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this list?')) return;
      const id = btn.dataset.id;
      await fetch(`/api/checklists/${id}`, { method: 'DELETE' });
      loadLists();
    });
  });
}

document.getElementById('create-list')?.addEventListener('click', async () => {
  if (!me.loggedIn) {
    alert('Please login to create lists');
    return;
  }

  const name = document.getElementById('new-list-name').value.trim();
  const desc = document.getElementById('new-list-desc').value.trim();
  if (!name) return alert('Name required');

  await fetch('/api/checklists', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, description: desc })
  });

  document.getElementById('new-list-name').value = '';
  document.getElementById('new-list-desc').value = '';
  loadLists();
});

document.addEventListener('change', async (e) => {
  if (e.target.matches('input[type=checkbox][data-id]')) {
    const id = e.target.dataset.id;
    await fetch(`/api/checklist/items/${id}/toggle`, { method: 'POST' });
    loadLists();
  }
});

// react to server updates via socket
const socket = io('/public');
socket.on('checklist-updated', loadLists);

loadLists();