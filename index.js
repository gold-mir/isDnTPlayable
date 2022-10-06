import fetch from 'node-fetch';
import { TwitterApi } from 'twitter-api-v2';
import secrets from './secrets.js';
import dotenv from 'dotenv';
import * as fs from 'node:fs/promises';
dotenv.config()

const userClient = new TwitterApi({
    appKey: secrets.API_KEY,
    appSecret: secrets.API_SECRET,
    accessToken: secrets.ACCESS_TOKEN,
    accessSecret: secrets.ACCESS_SECRET
})

//fetches all tweets from the last two months (assumed to be longer than any spoiler season) with related media data attached
//returns an array of objects containing a tweet object and an array of associated media objects
async function getTweetsWithMedia() {
    let startDate = new Date()
    startDate.setMonth(startDate.getMonth()-2)
    startDate.setHours(0,0,0,0)
    let result = await userClient.v2.userTimeline(secrets.ACCOUNT_ID, {expansions: 'attachments.media_keys', 
    "media.fields": 'type,alt_text,url', 
    max_results:100, 
    start_time: startDate.toISOString(),
    exclude: ['retweets', 'replies']})

    let output = []
    for(let tweetData of result.data.data) {
        let mediaKeys = tweetData.attachments?.media_keys || []
        let media = result.data.includes.media.filter(item => mediaKeys.includes(item.media_key))
        output.push({tweet: tweetData, media: media})
    }

    return output;
}

//fetches a list of cards, then removes all cards with a name matching the exclude list
async function getPossibleCardChoices(exclude) {
    const query = `order=cmc&q=c=w+not:reprint+set=${process.env.TARGET_SET}`
    const url = new URL(`https://api.scryfall.com/cards/search?${query}`)
    
    let response = await fetch(url.href)
    let body = await response.json()

    return body.data.filter((card) => !exclude.includes(card.name))
}

async function fetchCardImages(card) {
    const faces = []
    if(!['transform', 'modal_dfc'].includes(card.layout)) {
        let imageURI = card.image_uris.normal
        let filename = `${card.name}.jpg`
        let response = await fetch(imageURI)
        await fs.writeFile(`/tmp/${filename}`, response.body)
        faces.push({
            face: card,
            filename: filename
        })
    } else {
        for(let face of card.card_faces) {
            console.log(face)
            let imageURI = face.image_uris.normal
            let filename = `${face.name}.jpg`
            let response = await fetch(imageURI)
            await fs.writeFile(`/tmp/${filename}`, response.body)
            faces.push({
                face: face,
                filename: filename
            })
        }
    }

    return faces
}

export const handler = async (event) => {
    let prevTweets = await getTweetsWithMedia()
    let cardnames = []
    prevTweets.forEach((tweet) => {
        if(tweet.media.length > 0) {
            tweet.media.forEach((media) => {
                if(media.alt_text) {
                    let match = media.alt_text.match(/(?<=Magic: The Gathering card named )[^\n]+(?=.\n)/)
                    if(match) {
                        cardnames.push(match[0])
                    }
                }
            })
        }
    })

    let possibleCards = await getPossibleCardChoices(cardnames)
    if(possibleCards.length === 0) {
        console.log(`No new cards to tweet about`)
        return;
    }
    let card = possibleCards[Math.floor(Math.random()*possibleCards.length)]

    //download card images
    let faces = await fetchCardImages(card)
    let newMediaIDs = []

    //for each face, upload it to twitter and then generate alt text
    for(let [index, faceData] of faces.entries()) {
        let face = faceData.face
        let altText = `${faces.length > 1? `The ${index == 0? 'front' : 'back'} face of a ` : 'A'} Magic: The Gathering card named ${card.name}.
It is a ${face.cmc} mana value ${face.type_line}${face.power || face.loyalty ? ` with ${face.power? `${face.power} power and ${face.toughness} toughness` : `${face.loyalty} loyalty`}` : ''}.
It's oracle text is "${face.oracle_text}"`
        let mediaID = await userClient.v1.uploadMedia(`/tmp/${faceData.filename}`)
        await userClient.v1.createMediaMetadata(mediaID, {alt_text: {
            text: altText
        }})
        newMediaIDs.push(mediaID)
    }
    //send the tweet
    await userClient.v2.tweet({
        text: `${card.name} is D&T playable`,
        media: {
            media_ids: newMediaIDs
        }
    })
    console.log(`Successfully tweeted about ${card.name} being D&T playable`)

}