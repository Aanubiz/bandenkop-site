import { getToken } from '../utils/auth';
import { getApiUrl } from '../config';

const API_URL = getApiUrl();
const BLOCK_SIZE = 6;

type AssociationExercice = {
  _id: string;
  motFrancais: string;
  motBandenkop: string;
  motAnglais?: string;
  imageUrl?: string;
  audioUrl?: string;
  points?: number;
  niveau?: string;
};

type ExerciceResponse = {
  exercices: AssociationExercice[];
  hasMore?: boolean;
  error?: string;
};

type ResultatBloc = {
  bonnes: number;
  total: number;
  points: number;
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

class AssociationApp {
  token = null as string | null;
  page = 1;
  hasMore = false;
  exercices = [] as AssociationExercice[];
  selectedFrId = null as string | null;
  selectedBkValue = null as string | null;
  pairs = {} as Record<string, string>;
  totalPoints = 0;
  frOrder = [] as AssociationExercice[];
  bkOrder = [] as { value: string }[];

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
    document.getElementById('submit-block')?.addEventListener('click', () => void this.submitBlock());
    document.getElementById('continue-btn')?.addEventListener('click', () => void this.loadBlock(this.page + 1));
    document.getElementById('restart-btn')?.addEventListener('click', () => window.location.reload());
  }

  async loadBlock(page: number) {
    this.page = page;
    this.selectedFrId = null;
    this.selectedBkValue = null;
    this.pairs = {};

    document.getElementById('end')?.classList.add('hidden');
    document.getElementById('loading')?.classList.remove('hidden');
    document.getElementById('game')?.classList.add('hidden');

    try {
      const response = await fetch(`${API_URL}/api/association/exercices?niveau=debutant&limite=${BLOCK_SIZE}&page=${page}`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      const data = (await response.json()) as ExerciceResponse;
      if (!response.ok) throw new Error(data.error || 'Erreur de chargement');

      this.exercices = Array.isArray(data.exercices) ? data.exercices : [];
      this.hasMore = Boolean(data.hasMore);
      this.frOrder = shuffle(this.exercices);
      this.bkOrder = shuffle(this.exercices.map((e) => ({ value: e.motBandenkop })));

      if (!this.exercices.length) {
        throw new Error('Aucune association disponible. Ajoute des paires dans admin > apprentissage > association.');
      }

      document.getElementById('loading')?.classList.add('hidden');
      document.getElementById('game')?.classList.remove('hidden');

      this.render();
    } catch (error) {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.innerHTML = `<p class="text-red-600">${error instanceof Error ? error.message : 'Erreur inconnue'}</p>`;
      }
    }
  }

  render() {
    const niveau = document.getElementById('niveau');
    const counter = document.getElementById('counter');
    const progress = document.getElementById('progress');
    const frList = document.getElementById('fr-list');
    const bkList = document.getElementById('bk-list');
    const pairsView = document.getElementById('pairs-view');
    const submitBtn = document.getElementById('submit-block');

    if (niveau) niveau.textContent = this.exercices[0]?.niveau || 'debutant';

    const matched = Object.keys(this.pairs).length;
    if (counter) counter.textContent = `Bloc ${this.page} • ${matched}/${this.exercices.length} paires`;
    if (progress) progress.style.width = `${(matched / Math.max(1, this.exercices.length)) * 100}%`;

    if (frList) {
      frList.innerHTML = this.frOrder.map((e) => {
        const id = String(e._id);
        const active = this.selectedFrId === id;
        const done = Boolean(this.pairs[id]);
        return `<button data-fr-id="${id}" class="w-full text-left px-3 py-2 rounded-lg border ${done ? 'bg-green-50 border-green-300 text-green-700' : active ? 'bg-amber-100 border-amber-400' : 'bg-white border-gray-200 hover:bg-amber-50'}">${e.motFrancais}</button>`;
      }).join('');
    }

    if (bkList) {
      bkList.innerHTML = this.bkOrder.map((item) => {
        const active = this.selectedBkValue === item.value;
        const alreadyUsed = Object.values(this.pairs).includes(item.value);
        return `<button data-bk-value="${item.value}" class="w-full text-left px-3 py-2 rounded-lg border ${alreadyUsed ? 'bg-green-50 border-green-300 text-green-700' : active ? 'bg-amber-100 border-amber-400' : 'bg-white border-gray-200 hover:bg-amber-50'}">${item.value}</button>`;
      }).join('');
    }

    if (pairsView) {
      const rows = this.exercices
        .filter((e) => this.pairs[String(e._id)])
        .map((e) => `• ${e.motFrancais} → ${this.pairs[String(e._id)]}`)
        .join('<br/>');
      pairsView.innerHTML = rows || 'Aucune paire validée pour le moment.';
    }

    if (submitBtn instanceof HTMLButtonElement) {
      submitBtn.disabled = matched !== this.exercices.length;
    }

    this.attachPairClicks();
  }

  attachPairClicks() {
    document.querySelectorAll('[data-fr-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-fr-id');
        if (!id) return;
        this.selectedFrId = id;
        this.tryPair();
        this.render();
      });
    });

    document.querySelectorAll('[data-bk-value]').forEach((el) => {
      el.addEventListener('click', () => {
        const value = el.getAttribute('data-bk-value');
        if (!value) return;
        this.selectedBkValue = value;
        this.tryPair();
        this.render();
      });
    });
  }

  tryPair() {
    if (!this.selectedFrId || !this.selectedBkValue) return;
    this.pairs[this.selectedFrId] = this.selectedBkValue;
    this.selectedFrId = null;
    this.selectedBkValue = null;
  }

  async submitBlock() {
    try {
      const answers = this.exercices.map((e) => ({
        associationId: e._id,
        reponseBandenkop: this.pairs[String(e._id)] || '',
        tempsReponse: 5
      }));

      const response = await fetch(`${API_URL}/api/association/valider-bloc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify({ answers })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erreur validation bloc');

      this.totalPoints += data.pointsGagnes || 0;
      this.showEnd({
        bonnes: data.bonnes || 0,
        total: data.blocQuestions || answers.length,
        points: data.pointsGagnes || 0
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur inconnue');
    }
  }

  showEnd(result: ResultatBloc) {
    document.getElementById('game')?.classList.add('hidden');
    document.getElementById('end')?.classList.remove('hidden');

    const endText = document.getElementById('end-text');
    const continueBtn = document.getElementById('continue-btn');

    if (endText) {
      endText.textContent = `Bloc: ${result.bonnes}/${result.total} bonnes paires, ${result.points} points. Total comptabilisé: ${this.totalPoints} points.`;
    }

    if (continueBtn) {
      continueBtn.classList.toggle('hidden', !this.hasMore);
    }
  }
}

export function initAssociationApp() {
  void new AssociationApp().init();
}
