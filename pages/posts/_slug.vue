<template>
	<div>
		<h1 class="text-3xl text-gray-900">
			{{ post.title }}
		</h1>

        <nuxt-content :document="post" class="mt-4 prose sm:prose-lg max-w-none" />
	</div>
</template>

<script>
export default {
	async asyncData ({ $content, params, error }) {
		try {
            return { post: await $content(`posts/${params.slug}`).fetch() }
		} catch (e) {
			console.debug(e)
		}

		return error({ statusCode: 404, message: 'Post not found' })
	},

	head () {
		return {
			title : this.post.title,
			meta  : [
				{ hid: 'description', name: 'description', content: this.post.description },

				// Opengraph
				{ hid: 'og:title', name: 'og:title', content: this.post.title },
				{ hid: 'og:description', name: 'og:description', content: this.post.description },
				{ hid: 'og:type', name: 'og:type', content: 'article' },

			],

			// Specific theme for Prism.js
			link: [
				{
					hid    : 'prismjs',
					rel    : 'preload',
					href   : 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/themes/prism.min.css',
					as     : 'style',
					onload : "this.onload = null; this.rel = 'stylesheet';"
				},
			],

			__dangerouslyDisableSanitizersByTagID: {
				prismjs: ['onload']
			}
		}
	}
}
</script>
