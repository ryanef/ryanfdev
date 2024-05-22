import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from "@astrojs/tailwind";
import partytown from '@astrojs/partytown'

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://ryanf.dev',
  integrations: [mdx(), sitemap({
	filter: (page) => 
		page !== 'https://ryanf.dev/projects/tag' &&
		page !== 'https://ryanf.dev/blog/tag'
  }), tailwind(),		sitemap(),
		partytown({
			config: {
			  forward: ["dataLayer.push"],
			},
		}),]
});