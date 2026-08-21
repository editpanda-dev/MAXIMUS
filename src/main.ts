import './styles.css';
import { createHomeScene } from './view/home-scene';

document.title = '장한별 키우기';

const host = document.querySelector<HTMLElement>('#app');

if (host !== null) {
  void createHomeScene(host).then((scene) => {
    window.addEventListener('beforeunload', () => scene.destroy(), { once: true });
  }).catch(() => undefined);
}
