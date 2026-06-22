import { openModal, closeModal, closeModalOutside } from './ui/modals.js';
import { showHub } from './game/combat.js';
import { updateHUD } from './ui/hud.js';

// Expõe funções para os onclick do HTML
window.openModal         = openModal;
window.closeModal        = closeModal;
window.closeModalOutside = closeModalOutside;
window.showHub           = showHub;

// Inicializa HUD com dados salvos
updateHUD();

window.forceReload = function () {
  localStorage.removeItem('relixia-save');
  if ('caches' in window) {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => location.reload(true));
  } else {
    location.reload(true);
  }
};
