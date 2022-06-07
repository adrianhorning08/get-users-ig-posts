import axios from "axios";
import { CONSTANTS } from "./constants";
import { supabase } from "./supabaseClient";
import { processImage } from "./utils";

exports.handler = async (event: any, context: any) => {
	try {
		const userId = event.queryStringParameters?.userId;

		await getUserPosts(userId);

		return {
			statusCode: 200,
			body: JSON.stringify({ message: "success" }),
		};
	} catch (error) {
		console.log("error", error.message);
		return { statusCode: 500, body: JSON.stringify(error) };
	}
}

const GET_ALL_POSTS_URL = (instaId: string, providerToken: string) =>
	`${CONSTANTS.GRAPH_API_URL}/${instaId}/media?fields=caption,media_url,permalink,id,timestamp,children{media_url}&access_token=${providerToken}`;

async function getUserPosts(userId: string) {
	try {
		const user = await getUserById(userId);
		const postsRes = await getPostsFromInsta(
			user?.insta_id,
			user?.provider_token
		);
		const postsInReverse = [] as any[];
		const promises = [];
		console.log("fetching all posts for user");
		const posts = postsRes?.data || [];
		for (let i = 0; i < posts.length; i++) {
			const post = posts[i];
			postsInReverse.unshift(post);
		}
		for (let idx = 0; idx < postsInReverse.length; idx++) {
			const post = postsInReverse[idx];
			// }
			const dbPost = await createPost(post, user.id);
			// save the images
			if (post?.children) {
				for (let idx = 0; idx < post?.children?.data.length; idx++) {
					const child = post?.children?.data?.[idx];
					promises.push(
						processImage(
							child?.media_url,
							dbPost?.id,
							child?.id,
							true
						)
					);
				}
			} else {
				promises.push(
					processImage(post?.media_url, dbPost?.id, post?.id, false)
				);
			}
		}
		await Promise.all(promises);
		console.log("finished fetching all posts");
	} catch (error) {
		console.log("error fetching posts: " + error.message);
	}
}

async function getUserById(userId: string) {
	try {
		const res = await axios({
			url: `${CONSTANTS.API}/getUser`,
			method: "POST",
			data: {
				userId,
			},
		});
		return res?.data?.user;
	} catch (error) {
		console.log("error fetching user: " + error.message);
		throw new Error(error.message);
	}
}

async function createPost(igPost: InstagramPost, userId: string) {
	try {
		const res = await axios({
			method: "post",
			url: `${CONSTANTS.API}/createPost`,
			data: {
				igPost,
				userId,
			},
		});
		return res?.data?.post;
	} catch (error) {
		console.log("error creating post: " + error.message);
		throw new Error(error.message);
	}
}

async function getPostsFromInsta(
	instaId: string,
	providerToken: string,
	url = ""
) {
	try {
		console.log("calling get posts from insta");
		// this does get comments and replies, but I don't think we need them if we're always listening for comments
		const data = await axios({
			url: url || GET_ALL_POSTS_URL(instaId, providerToken),
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				params: Object.assign({ access_token: providerToken }),
			},
		});
		return data?.data;
	} catch (error) {
		console.log(
			"error at getPostsFromInsta",
			error?.response?.data?.error?.message
		);
		return {
			data: [],
		};
	}
}

async function getPostByInstaId(instaId: string): Promise<IPost | void> {
	try {
		const { data, error } = await supabase
			.from("posts")
			.select("*")
			.eq("insta_id", instaId);
		if (error) {
			console.log("error at getPostByInstaId", error.message);
		}
		if (data?.length) {
			return data?.[0];
		}
	} catch (error) {
		console.log("error getPostByInstaId: " + error.message);
	}
}


type InstagramComment = {
	timestamp: Date;
	text: string;
	id: string;
	from: From;
	media: Media;
	parent_id: string;
};

type From = {
	id: string;
	username: string;
};

type Media = {
	id: string;
};

type Owner = {
	id: string;
};
type InstaCommentOnInstaPost = {
	data: Array<InstagramComment>;
};
type InstagramPost = {
	id: string;
	caption: string; // description in the post
	timestamp: Date;
	media_url: string;
	media: Media;
	owner: Owner;
	username: string;
	comments: InstaCommentOnInstaPost;
	permalink: string;
};

interface IPost {
	id: number;
	insta_id: string;
	user_id: string;
	caption: string;
	bin: number;
	bid_start_amount: number;
	increment_amount: number;
	media_url: string;
	created_at: Date;
	updated_at: Date;
	is_paid: boolean;
	permalink: string;
	bid_start_time: Date;
	bid_end_time: Date;
	item_name: string;
	size: string;
	published: boolean;
}
