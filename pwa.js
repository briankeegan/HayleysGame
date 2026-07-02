(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  var banner = document.getElementById('installBanner');
  var bannerText = document.getElementById('installBannerText');
  var installBtn = document.getElementById('installBannerBtn');
  var closeBtn = document.getElementById('installBannerClose');
  if (!banner || !bannerText || !installBtn || !closeBtn) return;

  var isIphone = /iPhone|iPod/.test(navigator.userAgent);
  var isAndroid = /Android/.test(navigator.userAgent);
  var isInstalled =
    navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  var dismissed = false;
  try {
    dismissed = localStorage.getItem('installBannerDismissed') === '1';
  } catch (e) {}

  // iPhone can't trigger the install dialog from a page, so show instructions.
  if (isIphone && !isInstalled && !dismissed) {
    banner.classList.add('visible');
  }

  // Android fires beforeinstallprompt, letting an Install button open the
  // real install dialog directly.
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    if (!isAndroid || isInstalled || dismissed) return;
    deferredPrompt = event;
    bannerText.textContent = 'Play offline, right from your home screen';
    installBtn.hidden = false;
    banner.classList.add('visible');
  });

  installBtn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
      banner.classList.remove('visible');
    });
  });

  window.addEventListener('appinstalled', function () {
    banner.classList.remove('visible');
  });

  closeBtn.addEventListener('click', function () {
    banner.classList.remove('visible');
    try {
      localStorage.setItem('installBannerDismissed', '1');
    } catch (e) {}
  });
})();
