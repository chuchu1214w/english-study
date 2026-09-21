/* 入口：hash 路由 + 页面渲染 */
const App = (() => {
  const ROUTES = ['dashboard', 'vocab', 'plan', 'practice', 'notes', 'settings'];
  let current = 'dashboard';

  function route() {
    const name = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/')[0];
    const next = ROUTES.includes(name) ? name : 'dashboard';
    if (next !== current && Views[current] && Views[current].reset) Views[current].reset();
    current = next;
    render();
  }

  function render() {
    const el = document.getElementById('view');
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === current));
    try {
      Views[current].render(el);
    } catch (e) {
      console.error(e);
      el.innerHTML = `<div class="card"><h2>页面渲染出错</h2><pre class="code">${UI.esc(e.stack || e.message)}</pre></div>`;
    }
    window.scrollTo({ top: 0 });
  }

  function rerender() { render(); }
  function navigate(name) { location.hash = '#/' + name; }

  function init() {
    window.addEventListener('hashchange', route);
    Sync.init();
    route();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { rerender, navigate, get current() { return current; } };
})();
