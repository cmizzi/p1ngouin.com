<template>
	<main class="antialiased w-full px-4 sm:max-w-md lg:max-w-4xl mx-auto text-gray-800">
		<header class="py-4 flex justify-between">
			<nuxt-link to="/" class="text-2xl tracking-wide">p1ngouin</nuxt-link>

			<div class="ml-8 -mx-4 flex">
				<!-- <div class="px-4"><nuxt-link to="/">About me</nuxt-link></div> -->
				<!-- <div class="px-4"><nuxt-link to="/">Contact</nuxt-link></div> -->
			</div>
		</header>

		<section class="py-8">
			<nuxt />
		</section>

		<footer class="border-t-2 border-gray-200 text-gray-700 text-xs text-center py-4">
			<div class="sm:inline">&copy; p1ngouin.com</div>
			<div class="sm:inline hidden">|</div>
			<div class="sm:inline">
				Built with &#10084; using
				<a href="https://nuxtjs.org/" rel="_blank" class="underline">Nuxt.js</a>
				&amp;
				<a href="https://tailwindcss.com/" rel="_blank" class="underline">Tailwind.css</a>
			</div>
		</footer>
	</main>
</template>
