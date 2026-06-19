if (window.capsulariusDesktop?.isDesktop && window.capsulariusDesktop?.loadDesktopState) {
  window.__capsulariusDesktopSavedState = window.capsulariusDesktop
    .loadDesktopState()
    .catch((error) => {
      console.error('Capsularius could not read the desktop workspace JSON before startup.', error);
      return null;
    });
} else {
  window.__capsulariusDesktopSavedState = Promise.resolve(null);
}
