// ダークモード切り替えボタンの制御。
// 初期テーマ自体は index.html 内のインラインスクリプトで先に確定させている（ちらつき防止のため）。

function currentTheme() {
  const saved = document.documentElement.getAttribute('data-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateThemeButton(btn) {
  const isDark = currentTheme() === 'dark';
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.setAttribute('aria-label', isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え');
}

(function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  updateThemeButton(btn);
  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeButton(btn);
  });
})();
