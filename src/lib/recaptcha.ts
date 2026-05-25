type Grecaptcha = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

let recaptchaScriptPromise: Promise<void> | null = null;

const getRecaptchaSiteKey = () => process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

const loadRecaptchaScript = (siteKey: string) => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('reCAPTCHA can only run in the browser.'));
  }

  if (window.grecaptcha) {
    return Promise.resolve();
  }

  if (recaptchaScriptPromise) {
    return recaptchaScriptPromise;
  }

  recaptchaScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-recaptcha-script="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('reCAPTCHA script failed to load.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.recaptchaScript = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('reCAPTCHA script failed to load.'));
    document.head.appendChild(script);
  });

  return recaptchaScriptPromise;
};

export const executeRecaptcha = async (action: string) => {
  const siteKey = getRecaptchaSiteKey();
  if (!siteKey) return undefined;

  await loadRecaptchaScript(siteKey);

  if (!window.grecaptcha) {
    throw new Error('reCAPTCHA is not available.');
  }

  return new Promise<string>((resolve, reject) => {
    window.grecaptcha?.ready(() => {
      window.grecaptcha
        ?.execute(siteKey, { action })
        .then(resolve)
        .catch(reject);
    });
  });
};
