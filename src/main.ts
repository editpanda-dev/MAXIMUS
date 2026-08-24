import './styles.css';
import { createGameShell } from './view/game-shell';

document.title = '장한별 키우기';

const host = document.querySelector<HTMLElement>('#app');

if (host !== null) {
  const shell = createGameShell(host);
  window.addEventListener('beforeunload', () => shell.destroy(), { once: true });
}
