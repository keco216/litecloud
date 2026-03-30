import en from './en.json';
import de from './de.json';

export type Locale = 'en' | 'de';
export const locales: Locale[] = ['en', 'de'];
export const localeNames: Record<Locale, string> = { en: 'English', de: 'Deutsch' };

const translations: Record<Locale, Record<string, string>> = { en, de };

let locale = $state<Locale>(detectLocale());

function detectLocale(): Locale {
	if (typeof window === 'undefined') return 'en';
	const saved = localStorage.getItem('lc-locale') as Locale | null;
	if (saved && locales.includes(saved)) return saved;
	const browserLang = navigator.language.split('-')[0] as Locale;
	if (locales.includes(browserLang)) return browserLang;
	return 'en';
}

export function getLocale(): Locale {
	return locale;
}

export function setLocale(newLocale: Locale) {
	locale = newLocale;
	if (typeof window !== 'undefined') {
		localStorage.setItem('lc-locale', newLocale);
		document.documentElement.lang = newLocale;
	}
}

export function t(key: string, params?: Record<string, string | number>): string {
	let text = translations[locale]?.[key] ?? translations.en[key] ?? key;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			text = text.replaceAll(`{${k}}`, String(v));
		}
	}
	return text;
}
