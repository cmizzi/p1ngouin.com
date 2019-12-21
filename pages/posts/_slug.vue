<template>
	<div>
		<h1 class="text-3xl text-gray-900">
			{{ post.attributes.title }}
		</h1>

		<div v-html="post.html" class="mt-4 markup"></div>
	</div>
</template>

<script>
export default {
	async asyncData ({ params, error }) {
		try {
			return { post: await import(`~/content/posts/${params.slug}.md`) }
		} catch (e) {
			console.debug(e)
		}

		return error({ statusCode: 404, message: 'Post not found' })
	},

	computed: {
		// prismTheme () {
		// 	if (this.darkMode) {
		// 		return 'prism-tomorrow'
		// 	}

		// 	return 'prism'
		// }
	},

	head () {
		return {
			title : this.post.attributes.title,
			meta  : [
				{ hid: 'description', name: 'description', content: this.post.attributes.description },

				// Opengraph
				{ hid: 'og:title', name: 'og:title', content: this.post.attributes.title },
				{ hid: 'og:description', name: 'og:description', content: this.post.attributes.description },
				{ hid: 'og:type', name: 'og:type', content: 'article' },

			],

			// Specific theme for Prism.js
			link: [
				{ hid: 'prismjs', rel: 'stylesheet', href: `https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/themes/prism.min.css` },
				// { hid: 'prismjs', rel: 'stylesheet', href: `https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/themes/${this.prismTheme}.min.css` },
			]
		}
	}
}
</script>
