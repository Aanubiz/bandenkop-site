import { getToken } from '../utils/auth';
import { getApiUrl } from '../config';

type AssocIconItem = {
  _id: string;
  motFrancais: string;
  motBandenkop: string;
  iconUrl?: string;
  iconSvg?: string;
  categorie?: string;
  niveau?: string;
};

const API_URL = getApiUrl();
const token = getToken();
let items: AssocIconItem[] = [];

const iconPreview = (item: AssocIconItem) => {
  if (item.iconSvg) return `<div class="w-8 h-8 text-gray-700">${item.iconSvg}</div>`;
  if (item.iconUrl) return `<img src="${item.iconUrl}" class="w-8 h-8 object-contain" alt="icon" />`;
  return '<span class="text-gray-400">—</span>';
};

const render = () => {
  const tbody = document.getElementById('list');
  if (!tbody) return;

  const searchEl = document.getElementById('searchFilter') as HTMLInputElement | null;
  const search = (searchEl?.value || '').toLowerCase().trim();
  const filtered = search
    ? items.filter((item) => {
        const txt = `${item.motFrancais} ${item.motBandenkop} ${item.categorie || ''} ${item.niveau || ''}`.toLowerCase();
        return txt.includes(search);
      })
    : items;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Aucun élément</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((item, idx) => `
    <tr>
      <td class="px-6 py-4 text-gray-400 text-sm w-10">${idx + 1}</td>
      <td class="px-6 py-4">${item.motFrancais}</td>
      <td class="px-6 py-4">${iconPreview(item)}</td>
      <td class="px-6 py-4">${item.motBandenkop}</td>
      <td class="px-6 py-4">${item.niveau}</td>
      <td class="px-6 py-4 text-right space-x-2">
        <button data-edit-id="${item._id}" class="text-blue-600 hover:text-blue-800">✏️</button>
        <button data-delete-id="${item._id}" class="text-red-600 hover:text-red-800">🗑️</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-id');
      if (id) editItem(id);
    });
  });

  tbody.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-id');
      if (id) void deleteItem(id);
    });
  });
};

const loadItems = async () => {
  const response = await fetch(`${API_URL}/api/admin/association-image`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  items = Array.isArray(data) ? data : [];
  render();
};

const openModal = () => {
  const modal = document.getElementById('modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const title = document.getElementById('modal-title');
  if (title) title.textContent = 'Ajouter une association icône';

  const form = document.getElementById('form');
  if (form instanceof HTMLFormElement) {
    form.reset();
    const idInput = form.elements.namedItem('id');
    if (idInput instanceof HTMLInputElement) idInput.value = '';
  }
};

const closeModal = () => {
  const modal = document.getElementById('modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
};

const editItem = (id: string) => {
  const item = items.find((x) => x._id === id);
  if (!item) return;

  const form = document.getElementById('form');
  if (!(form instanceof HTMLFormElement)) return;

  const title = document.getElementById('modal-title');
  if (title) title.textContent = 'Éditer une association icône';

  const idInput = form.elements.namedItem('id');
  const motFrInput = form.elements.namedItem('motFrancais');
  const motBkInput = form.elements.namedItem('motBandenkop');
  const iconUrlInput = form.elements.namedItem('iconUrl');
  const iconSvgInput = form.elements.namedItem('iconSvg');
  const categorieSelect = form.elements.namedItem('categorie');
  const niveauSelect = form.elements.namedItem('niveau');

  if (idInput instanceof HTMLInputElement) idInput.value = item._id;
  if (motFrInput instanceof HTMLInputElement) motFrInput.value = item.motFrancais || '';
  if (motBkInput instanceof HTMLInputElement) motBkInput.value = item.motBandenkop || '';
  if (iconUrlInput instanceof HTMLInputElement) iconUrlInput.value = item.iconUrl || '';
  if (iconSvgInput instanceof HTMLTextAreaElement) iconSvgInput.value = item.iconSvg || '';
  if (categorieSelect instanceof HTMLSelectElement) categorieSelect.value = item.categorie || 'objet';
  if (niveauSelect instanceof HTMLSelectElement) niveauSelect.value = item.niveau || 'debutant';

  const modal = document.getElementById('modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
};

const deleteItem = async (id: string) => {
  if (!confirm('Supprimer cet élément ?')) return;
  await fetch(`${API_URL}/api/admin/association-image/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  await loadItems();
};

const bindForm = () => {
  document.getElementById('open-add')?.addEventListener('click', openModal);
  document.getElementById('close-modal')?.addEventListener('click', closeModal);
  document.getElementById('searchFilter')?.addEventListener('input', render);

  document.getElementById('form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    const data = new FormData(form);
    const payload = {
      motFrancais: String(data.get('motFrancais') || '').trim(),
      motBandenkop: String(data.get('motBandenkop') || '').trim(),
      iconUrl: String(data.get('iconUrl') || '').trim(),
      iconSvg: String(data.get('iconSvg') || '').trim(),
      categorie: String(data.get('categorie') || 'objet'),
      niveau: String(data.get('niveau') || 'debutant'),
      points: 1
    };

    if (!payload.iconUrl && !payload.iconSvg) {
      alert('Ajoute un lien d’icône ou un code SVG.');
      return;
    }

    const id = String(data.get('id') || '');
    const url = id ? `${API_URL}/api/admin/association-image/${id}` : `${API_URL}/api/admin/association-image`;
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      alert(err.error || 'Erreur lors de l’enregistrement');
      return;
    }

    closeModal();
    await loadItems();
  });
};

export function initAdminAssociationImagePage() {
  if (!token) {
    window.location.href = '/connexion';
    return;
  }

  bindForm();
  void loadItems();
}
