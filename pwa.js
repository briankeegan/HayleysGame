(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  // Secret clubhouse entrance: triple-tap the invisible top-right corner.
  var secretDoor = document.getElementById('secretDoor');
  if (secretDoor) {
    var taps = 0;
    var tapTimer = null;
    secretDoor.addEventListener('click', function () {
      taps++;
      clearTimeout(tapTimer);
      if (taps >= 3) {
        taps = 0;
        window.location.href = 'clubhouse.html';
        return;
      }
      tapTimer = setTimeout(function () {
        taps = 0;
      }, 1500);
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

  // Reserve the banner's on-screen footprint via --banner-space so the board
  // re-centers in the space above it, and let the game re-run its layout.
  function showBanner() {
    banner.classList.add('visible');
    var rect = banner.getBoundingClientRect();
    var space = Math.max(0, window.innerHeight - rect.top) + 8;
    document.documentElement.style.setProperty('--banner-space', space + 'px');
    window.dispatchEvent(new Event('resize'));
  }

  function hideBanner() {
    banner.classList.remove('visible');
    document.documentElement.style.setProperty('--banner-space', '0px');
    window.dispatchEvent(new Event('resize'));
  }

  // iPhone can't trigger the install dialog from a page, so show instructions.
  if (isIphone && !isInstalled && !dismissed) {
    showBanner();
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
    showBanner();
  });

  installBtn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
      hideBanner();
    });
  });

  window.addEventListener('appinstalled', hideBanner);

  closeBtn.addEventListener('click', function () {
    hideBanner();
    try {
      localStorage.setItem('installBannerDismissed', '1');
    } catch (e) {}
  });
})();
