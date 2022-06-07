import { supabase } from "./supabaseClient";
import stream from "stream";
import { promisify } from "util";
import fs from "graceful-fs";
import "dotenv/config";
import got from "got";
const pipeline = promisify(stream.pipeline);

async function downloadImage(url: string, fileName: string) {
	try {
		await pipeline(got.stream(url), fs.createWriteStream(fileName));
		console.log("downloaded image successfully");
	} catch (error) {
		console.log("error downloading image", error);
	}
}

async function uploadImage(postId: number, fileName: string, childId: string) {
	const fileContent = fs.readFileSync(fileName);
	const { error } = await supabase.storage
		.from("post-images")
		.upload(`${postId}/${childId}.jpg`, fileContent, {
			cacheControl: "3600",
			upsert: false,
		});
	if (error) {
		console.log("error uploadImage", error);
	} else {
		console.log("upload to storage success");
		const { error } = await supabase.from("post_images").insert([
			{
				post_id: postId,
				image_id: childId,
			},
		]);
		if (error) {
			console.log("inserted post_images error", error);
		} else {
			console.log("inserted post_images success");
		}
	}
}

export const processImage = async (
	url: string,
	postId: number,
	childId: string,
	isChild: boolean
) => {
	const tmpFileName = `/tmp/${isChild ? childId : postId}.jpg`;
	await downloadImage(url, tmpFileName);
	await uploadImage(postId, tmpFileName, childId);
	fs.unlinkSync(tmpFileName);
};
