import process from 'node:process';
import { Octokit } from '@octokit/rest';
import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, {
	retries: 5,
	retryDelay: (retryCount) => {
		return retryCount * 1000;
	},
});

(async () => {
	const partlist = ['banner-slider', 'topics-acgn', 'topics-weekly-bangumi', 'topics-vtubers', 'topics-music', 'topics-memes', 'topics-others'];

	async function getData(part: string): Promise<string> {
		const url = `https://storage.moegirl.org.cn/homeland/data/${part}.json`;
		const { data } = await axios.get(url);
		return data;
	}

	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN,
	});
	const owner = 'moepad';
	const repo = 'zh-mainpage';
	const files: { path: string; content: string; sha: string }[] = [];

	try {
		const { data: { object: { sha } } } = await octokit.git.getRef({
			owner,
			repo,
			ref: 'heads/main',
		});
		
		await Promise.all(partlist.map(async (part) => {
			const path: string = `data/${part}.json`;
			const content: string = JSON.stringify(await getData(part), null, '  ');
			const { data: { sha } } = await octokit.git.createBlob({
				owner,
				repo,
				content,
				encoding: 'utf-8' as const,
			});
			files.push({
				path,
				content,
				sha,
			});
		}));

		const { data: tree } = await octokit.git.createTree({
			owner,
			repo,
			base_tree: sha,
			tree: files.map((file) => ({
				path: file.path,
				mode: '100644' as const,
				type: 'blob' as const,
				sha: file.sha,
			})),
		});

		const { data: commit } = await octokit.git.createCommit({
			owner,
			repo,
			message: `auto: update data at ${new Date().toISOString()}`,
			tree: tree.sha,
			parents: [sha],
		});
	
		await octokit.git.updateRef({
			owner,
			repo,
			ref: 'heads/main',
			sha: commit.sha,
		});
	
		console.log('Successfully!');
	} catch (error) {
		console.error('Error:', error);
	}
})();