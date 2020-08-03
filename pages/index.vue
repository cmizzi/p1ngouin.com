<template>
	<div>
		<div class="mb-8" v-for="post in posts" :key="post.slug">
			<h2 class="text-xl underline text-gray-800 font-semibold">
				<nuxt-link :to="post.path">
					{{ post.title }}
				</nuxt-link>
			</h2>

			<p class="mt-2 prose sm:prose-lg max-w-none">
				{{ post.description }}
			</p>
		</div>
	</div>
</template>

<script>
export default {
	async asyncData ({ $content, params }) {
        const posts = await $content('posts').sortBy('date', 'desc').fetch()

		return {
			posts: posts,
		}
	},

	watchQuery: [
		'page'
	],
}
</script>
