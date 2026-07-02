(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  var banner = document.getElementById('installBanner');
  var closeBtn = document.getElementById('installBannerClose');
  if (!banner || !closeBtn) return;

  var isIphone = /iPhone|iPod/.test(navigator.userAgent);
  var isInstalled =
    navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  var dismissed = false;
  try {
    dismissed = localStorage.getItem('installBannerDismissed') === '1';
  } catch (e) {}

  if (isIphone && !isInstalled && !dismissed) {
    banner.classList.add('visible');
  }

  closeBtn.addEventListener('click', function () {
    banner.classList.remove('visible');
    try {
      localStorage.setItem('installBannerDismissed', '1');
    } catch (e) {}
  });
})();
