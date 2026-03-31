/**
 * Material Design SVG icon paths for AnimatedIcon morph transitions.
 * Paths sourced from google/material-design-icons (24x24 viewBox).
 */

export const ICON_PATHS = {
	// Navigation
	menu: 'M3,6 L21,6 L21,8 L3,8 Z M3,11 L21,11 L21,13 L3,13 Z M3,16 L21,16 L21,18 L3,18 Z',
	arrow_back: 'M20,11 L7.83,11 L13.42,5.41 L12,4 L4,12 L12,20 L13.41,18.59 L7.83,13 L20,13 Z',
	close: 'M19,6.41 L17.59,5 L12,10.59 L6.41,5 L5,6.41 L10.59,12 L5,17.59 L6.41,19 L12,13.41 L17.59,19 L19,17.59 L13.41,12 Z',

	// Media
	play: 'M8,5 L8,19 L19,12 Z',
	pause: 'M6,19 L10,19 L10,5 L6,5 Z M14,5 L14,19 L18,19 L18,5 Z',

	// Actions
	add: 'M19,13 L13,13 L13,19 L11,19 L11,13 L5,13 L5,11 L11,11 L11,5 L13,5 L13,11 L19,11 Z',
	check: 'M9,16.17 L4.83,12 L3.41,13.41 L9,19 L21,7 L19.59,5.59 Z',
	remove: 'M19,13 L5,13 L5,11 L19,11 Z',

	// File
	upload: 'M9,16 L15,16 L15,10 L19,10 L12,3 L5,10 L9,10 Z M5,18 L19,18 L19,20 L5,20 Z',
	download: 'M19,9 L15,9 L15,3 L9,3 L9,9 L5,9 L12,16 Z M5,18 L19,18 L19,20 L5,20 Z',
	cloud_done: 'M19.35,10.04 C18.67,6.59 15.64,4 12,4 C9.11,4 6.6,5.64 5.35,8.04 C2.34,8.36 0,10.91 0,14 C0,17.31 2.69,20 6,20 L19,20 C21.76,20 24,17.76 24,15 C24,12.36 21.95,10.22 19.35,10.04 Z M10,17 L6.5,13.5 L7.91,12.09 L10,14.17 L15.18,9 L16.59,10.41 Z',

	// Search
	search: 'M15.5,14 L14.71,14 L14.43,13.73 C15.41,12.59 16,11.11 16,9.5 C16,5.91 13.09,3 9.5,3 C5.91,3 3,5.91 3,9.5 C3,13.09 5.91,16 9.5,16 C11.11,16 12.59,15.41 13.73,14.43 L14,14.71 L14,15.5 L19,20.49 L20.49,19 Z M9.5,14 C7.01,14 5,11.99 5,9.5 C5,7.01 7.01,5 9.5,5 C11.99,5 14,7.01 14,9.5 C14,11.99 11.99,14 9.5,14 Z',

	// Visibility
	visibility: 'M12,4.5 C7,4.5 2.73,7.61 1,12 C2.73,16.39 7,19.5 12,19.5 C17,19.5 21.27,16.39 23,12 C21.27,7.61 17,4.5 12,4.5 Z M12,17 C9.24,17 7,14.76 7,12 C7,9.24 9.24,7 12,7 C14.76,7 17,9.24 17,12 C17,14.76 14.76,17 12,17 Z M12,9 C10.34,9 9,10.34 9,12 C9,13.66 10.34,15 12,15 C13.66,15 15,13.66 15,12 C15,10.34 13.66,9 12,9 Z',
	visibility_off: 'M12,7 C14.76,7 17,9.24 17,12 C17,12.65 16.87,13.26 16.64,13.83 L19.56,16.75 C21.07,15.49 22.26,13.86 23,12 C21.27,7.61 17,4.5 12,4.5 C10.6,4.5 9.26,4.75 8.01,5.2 L10.17,7.36 C10.74,7.13 11.35,7 12,7 Z M2,4.27 L4.28,6.55 L4.74,7.01 C3.08,8.3 1.78,10.02 1,12 C2.73,16.39 7,19.5 12,19.5 C13.55,19.5 15.03,19.2 16.38,18.66 L16.81,19.08 L19.73,22 L21,20.73 L3.27,3 Z M7.53,9.8 L9.08,11.35 C9.03,11.56 9,11.78 9,12 C9,13.66 10.34,15 12,15 C12.22,15 12.44,14.97 12.65,14.92 L14.2,16.47 C13.53,16.8 12.79,17 12,17 C9.24,17 7,14.76 7,12 C7,11.21 7.2,10.47 7.53,9.8 Z M11.84,9.02 L14.99,12.17 L15.01,12.01 C15.01,10.35 13.67,9.01 12.01,9.01 Z',

	// Bookmark
	bookmark_outline: 'M17,3 L7,3 C5.9,3 5.01,3.9 5.01,5 L5,21 L12,18 L19,21 L19,5 C19,3.9 18.1,3 17,3 Z M17,18 L12,15.82 L7,18 L7,5 L17,5 Z',
	bookmark_filled: 'M17,3 L7,3 C5.9,3 5.01,3.9 5.01,5 L5,21 L12,18 L19,21 L19,5 C19,3.9 18.1,3 17,3 Z',

	// Star
	star_outline: 'M22,9.24 L14.81,8.62 L12,2 L9.19,8.63 L2,9.24 L7.46,13.97 L5.82,21 L12,17.27 L18.18,21 L16.55,13.97 Z M12,15.4 L8.24,17.67 L9.24,13.39 L5.92,10.51 L10.3,10.13 L12,6.1 L13.71,10.14 L18.09,10.52 L14.77,13.4 L15.77,17.68 Z',
	star_filled: 'M12,17.27 L18.18,21 L16.54,13.97 L22,9.24 L14.81,8.63 L12,2 L9.19,8.63 L2,9.24 L7.46,13.97 L5.82,21 Z',

	// Favorite
	favorite_outline: 'M16.5,3 C14.76,3 13.09,3.81 12,5.09 C10.91,3.81 9.24,3 7.5,3 C4.42,3 2,5.42 2,8.5 C2,12.28 5.4,15.36 10.55,20.04 L12,21.35 L13.45,20.03 C18.6,15.36 22,12.28 22,8.5 C22,5.42 19.58,3 16.5,3 Z M12.1,18.55 L12,18.65 L11.9,18.55 C7.14,14.24 4,11.39 4,8.5 C4,6.5 5.5,5 7.5,5 C9.04,5 10.54,5.99 11.07,7.36 L12.94,7.36 C13.46,5.99 14.96,5 16.5,5 C18.5,5 20,6.5 20,8.5 C20,11.39 16.86,14.24 12.1,18.55 Z',
	favorite_filled: 'M12,21.35 L10.55,20.03 C5.4,15.36 2,12.28 2,8.5 C2,5.42 4.42,3 7.5,3 C9.24,3 10.91,3.81 12,5.09 C13.09,3.81 14.76,3 16.5,3 C19.58,3 22,5.42 22,8.5 C22,12.28 18.6,15.36 13.45,20.04 Z'
} as const;

/** Pre-defined morph pairs for easy use */
export const MORPH_PAIRS = {
	menuToArrow: { from: ICON_PATHS.menu, to: ICON_PATHS.arrow_back },
	menuToClose: { from: ICON_PATHS.menu, to: ICON_PATHS.close },
	addToClose: { from: ICON_PATHS.add, to: ICON_PATHS.close },
	addToCheck: { from: ICON_PATHS.add, to: ICON_PATHS.check },
	playToPause: { from: ICON_PATHS.play, to: ICON_PATHS.pause },
	searchToClose: { from: ICON_PATHS.search, to: ICON_PATHS.close },
	uploadToCheck: { from: ICON_PATHS.upload, to: ICON_PATHS.check },
	downloadToCheck: { from: ICON_PATHS.download, to: ICON_PATHS.check },
	starOutlineToFilled: { from: ICON_PATHS.star_outline, to: ICON_PATHS.star_filled },
	favoriteOutlineToFilled: { from: ICON_PATHS.favorite_outline, to: ICON_PATHS.favorite_filled },
	bookmarkOutlineToFilled: { from: ICON_PATHS.bookmark_outline, to: ICON_PATHS.bookmark_filled },
	visibilityToggle: { from: ICON_PATHS.visibility, to: ICON_PATHS.visibility_off }
} as const;
