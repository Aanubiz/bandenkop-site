import { getToken } from '../utils/auth';
import { getApiUrl } from '../config';

const API_URL = getApiUrl();
const BLOCK_SIZE = 3;

type Exercice = {
  _id: string;
  motFrancais: string;
  motBandenkop: string;
  iconUrl?: string;
  iconSvg?: string;
  niveau?: string;
};

type Answer = {
  frId: string;
  iconId: string;
  bkId: string;
  tempsReponse: number;
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

class AssociationImageApp {
  token: string | null = null;
  exercices: Exercice[] = [];
  frOrder: Exercice[] = [];
  iconOrder: Exercice[] = [];
  bkOrder: Exercice[] = [];
  selectedFrId: string | null = null;
  selectedIconId: string | null = null;
  selectedBkId: string | null = null;
  answers: Answer[] = [];
  page = 1;
  hasMore = false;
  totalScore = 0;

  async init() {
    this.token = getToken();
    if (!this.token) {
      window.location.href = '/connexion';
      return;
    }

    this.attachEvents();
    await this.loadBlock(1);
  }

  attachEvents() {
    document.getElementById('btn-validate')?.addEventListener('click', () => void this.submitBlock());
    document.getElementById('btn-next')?.addEventListener('click', () => void this.loadBlock(this.page + 1));
    document.getElementById('btn-restart')?.addEventListener('click', () => window.location.reload());
  }

  async loadBlock(page: number) {
    this.page = page;
    this.selectedFrId = null;
    this.selectedIconId = null;
    this.selectedBkId = null;
    this.answers = [];

    document.getElementById('feedback')?.classList.add('hidden');
    document.getElementById('end')?.classList.add('hidden');
    document.getElementById('game')?.classList.remove('hidden');

    document.getElementById('feedback')?.classList.add('hidden');

    const response = await fetch(`${API_URL}/api/association-image/exercices?niveau=debutant&limite=${BLOCK_SIZE}&page=${page}`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data?.error || 'Erreur de chargement');
      return;
    }

    this.exercices = Array.isArray(data.exercices) ? data.exercices.slice(0, BLOCK_SIZE) : [];
    this.hasMore = Boolean(data.hasMore);

    if (!this.exercices.length) {
      alert('Aucune donnée association icône disponible.');
      return;
    }

    this.frOrder = shuffle(this.exercices);
    this.iconOrder = shuffle(this.exercices);
    this.bkOrder = shuffle(this.exercices);

    this.render();
  }

  render() {
    const niveau = document.getElementById('niveau');
    const score = document.getElementById('score');
    const frList = document.getElementById('fr-list');
    const iconList = document.getElementById('icon-list');
    const bkList = document.getElementById('bk-list');
    const selectedCount = document.getElementById('selected-count');
    const btn = document.getElementById('btn-validate');

    if (niveau) niveau.textContent = this.exercices[0]?.niveau || 'debutant';
    if (score) score.textContent = `${this.totalScore} pts`;
    if (selectedCount) selectedCount.textContent = `${this.answers.length}/${this.exercices.length}`;

    if (frList) {
      frList.innerHTML = this.frOrder.slice(0, BLOCK_SIZE).map((e) => {
        const active = this.selectedFrId === e._id;
        const used = this.answers.some((a) => a.frId === e._id);
        return `<button data-fr-id="${e._id}" class="w-full text-left px-3 py-2 rounded-lg border ${used ? 'bg-green-50 border-green-300' : active ? 'bg-amber-100 border-amber-400' : 'bg-white border-gray-200 hover:bg-amber-50'}">${e.motFrancais}</button>`;
      }).join('');
    }

    if (iconList) {
      iconList.innerHTML = this.iconOrder.slice(0, BLOCK_SIZE).map((e) => {
        const active = this.selectedIconId === e._id;
        const used = this.answers.some((a) => a.iconId === e._id);
        const icon = e.iconSvg
          ? `<div class="w-8 h-8">${e.iconSvg}</div>`
          : e.iconUrl
          ? `<img src="${e.iconUrl}" class="w-8 h-8 object-contain" alt="icône" />`
          : '<span>🔘</span>';
        return `<button data-icon-id="${e._id}" class="w-full px-3 py-2 rounded-lg border flex items-center justify-center ${used ? 'bg-green-50 border-green-300' : active ? 'bg-amber-100 border-amber-400' : 'bg-white border-gray-200 hover:bg-amber-50'}">${icon}</button>`;
      }).join('');
    }

    if (bkList) {
      bkList.innerHTML = this.bkOrder.slice(0, BLOCK_SIZE).map((e) => {
        const active = this.selectedBkId === e._id;
        const used = this.answers.some((a) => a.bkId === e._id);
        return `<button data-bk-id="${e._id}" class="w-full text-left px-3 py-2 rounded-lg border ${used ? 'bg-green-50 border-green-300' : active ? 'bg-amber-100 border-amber-400' : 'bg-white border-gray-200 hover:bg-amber-50'}">${e.motBandenkop}</button>`;
      }).join('');
    }

    if (btn instanceof HTMLButtonElement) {
      btn.disabled = this.answers.length !== this.exercices.length;
    }

    this.bindChoiceEvents();
  }

  bindChoiceEvents() {
    document.querySelectorAll('[data-fr-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-fr-id');
        if (!id) return;
        this.selectedFrId = id;
        this.tryMakeTriplet();
        this.render();
      });
    });

    document.querySelectorAll('[data-icon-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-icon-id');
        if (!id) return;
        this.selectedIconId = id;
        this.tryMakeTriplet();
        this.render();
      });
    });

    document.querySelectorAll('[data-bk-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-bk-id');
        if (!id) return;
        this.selectedBkId = id;
        this.tryMakeTriplet();
        this.render();
      });
    });
  }

  tryMakeTriplet() {
    if (!this.selectedFrId || !this.selectedIconId || !this.selectedBkId) return;

    const duplicated = this.answers.some((a) =>
      a.frId === this.selectedFrId || a.iconId === this.selectedIconId || a.bkId === this.selectedBkId
    );
    if (duplicated) return;

    this.answers.push({
      frId: this.selectedFrId,
      iconId: this.selectedIconId,
      bkId: this.selectedBkId,
      tempsReponse: 5
    });

    this.selectedFrId = null;
    this.selectedIconId = null;
    this.selectedBkId = null;
  }

  async submitBlock() {
    const response = await fetch(`${API_URL}/api/association-image/valider-bloc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`
      },
      body: JSON.stringify({
        answers: this.answers
      })
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data?.error || 'Erreur de validation');
      return;
    }

    this.totalScore += Number(data.pointsGagnes || 0);

    const feedback = document.getElementById('feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      feedback.className = 'mt-4 rounded-lg p-3 text-sm bg-amber-100 text-amber-800';
      feedback.textContent = `Bloc validé: ${data.bonnes}/${data.blocQuestions} triplets corrects • +${data.pointsGagnes} point(s)`;
    }

    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.textContent = `${this.totalScore} pts`;

    document.getElementById('game')?.classList.add('hidden');
    document.getElementById('end')?.classList.remove('hidden');

    const endText = document.getElementById('end-text');
    if (endText) {
      endText.textContent = `Résultat du bloc: ${data.bonnes}/${data.blocQuestions} • Total: ${this.totalScore} pts`;
    }

    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) {
      nextBtn.classList.toggle('hidden', !this.hasMore);
    }
  }
}

export function initAssociationImageApp() {
  void new AssociationImageApp().init();
}
