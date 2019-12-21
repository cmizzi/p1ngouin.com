<template>
	<div>
		<div class="mb-8" v-for="post in posts" :key="post.attributes.date">
			<h2 class="text-xl underline text-gray-900 font-semibold">
				<nuxt-link :to="getPermalink(post)">
					{{ post.attributes.title }}
				</nuxt-link>
			</h2>

			<p class="mt-2">
				{{ post.attributes.description }}
			</p>
		</div>
	</div>
</template>

<script>
export default {
	async asyncData ({ params }) {
		const resolve = require.context('~/content', true, /\.md$/)
		const current = (params.page || 1) - 1
		const limit   = 10
		const offset  = ((params.page || 1) - 1) * limit
		const pages   = Math.ceil(resolve.keys().length / limit)
		const imports = resolve.keys()
			.map(key => resolve(key))
			.sort((a, b) => Date.parse(b.attributes.date) - Date.parse(a.attributes.date))
			.splice(offset, limit)
			.map(post => ({...post, html: post.description}))

		return {
			posts       : imports,
			hasNextPage : pages > 1 && current + 1 <= pages,
			hasPrevPage : pages > 1 && current + 1 > 0,
		}
	},

	watchQuery: [
		'page'
	],

	methods: {
		getPermalink (post) {
			return `/posts/${post.meta.resourcePath.split('\\').pop().split('/').pop().split('.')[0]}`
		}
	}
}
</script>
