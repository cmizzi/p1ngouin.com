import { join, resolve, basename } from 'path'
import Mode from 'frontmatter-markdown-loader/mode'
import md from 'markdown-it'
import prism from 'markdown-it-prism'
import 'prismjs/components/prism-docker'
import 'prismjs/components/prism-diff'
import glob from 'glob'

const dynamicRoutes = {
	'/posts': 'posts/*.md'
}

export default {
	mode: 'universal',

	/*
	 ** Headers of the page
	 */
	head: {
		title: 'Cyril Mizzi\'s blog on PHP, Docker, Javascript and more!',
		htmlAttrs: { lang: 'en' },
		meta: [
			{ charset: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ hid: 'description', name: 'description', content: 'Full-stack web developer, sysadmin, I share my experiences with everyone.' },

			// Opengraph
			{ hid: 'og:description', name: 'og:description', content: 'Full-stack web developer, sysadmin, I share my experiences with everyone.' },
			{ hid: 'og:site_name', name: 'og:site_name', content: 'p1ngouin.com' },
			{ hid: 'og:locale', name: 'og:locale', content: 'en_US' },
		],
		link: [
			{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
		]
	},

	/*
	 ** Customize the progress-bar color
	 */
	loading: { color: '#fff' },

	/*
	 ** Generate dynamic routes.
	 */
	generate: {
		routes: [
			...[].concat(
				...Object.keys(dynamicRoutes).map((url) => {
					return glob
						.sync(dynamicRoutes[url], { cwd: 'content' })
						.map(filepath => `${url}/${basename(filepath, '.md')}`)
				})
			)
		]
	},

	/*
	 ** Global CSS
	 */
	css: [],

	/*
	 ** Do not trim specific classes.
	 */
	purgeCSS: {
		whitelist: ['markup']
	},

	/*
	 ** Plugins to load before mounting the App
	 */
	plugins: [],

	/*
	 ** Nuxt.js dev-modules
	 */
	buildModules: [
		'@nuxtjs/tailwindcss',
		'@nuxtjs/google-analytics',
	],

	googleAnalytics: {
		id  : 'UA-134180672-1',
		dev : false
	},

	/*
	 ** Nuxt.js modules
	 */
	modules: [
		'nuxt-trailingslash-module',
		'@nuxtjs/sitemap',
		'@bazzite/nuxt-netlify',
	],

	/*
	 ** Netlify configuration.
	 */
	netlify: {
		mergeSecurityHeaders: true
	},

	/*
	 ** Configure sitemap generation.
	 */
	sitemap: {
		hostname: process.env.BASE_URL || 'https://p1ngouin.com',
		gzip: false,
	},

	/*
	 ** Build configuration
	 */
	build: {
		postcss: {
			plugins: {
				'tailwindcss' : join(__dirname, 'tailwind.config.js'),
				'postcss-nested' : {},
			}
		},

		/*
		 ** You can extend webpack config here
		 */
		extend (config, ctx) {
			config.module.rules.push({
				test    : /\.md$/,
				include : resolve(__dirname, "content"),
				loader  : "frontmatter-markdown-loader",
				options : {
					markdownIt : md({ html: true }).use(prism),
					mode       : [Mode.HTML, Mode.META]
				}
			});
		}
	}
}
