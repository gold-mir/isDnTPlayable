import fetch from 'node-fetch';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import * as fs from 'node:fs/promises';
dotenv.config()

const userClient = new TwitterApi({
    appKey: process.env.API_KEY,
    appSecret: process.env.API_SECRET,
    accessToken: process.env.ACCESS_TOKEN,
    accessSecret: process.env.ACCESS_SECRET
})

//fetches all tweets from the last two months (assumed to be longer than any spoiler season) with related media data attached
//returns an array of objects containing a tweet object and an array of associated media objects
async function getTweetsWithMedia() {
    let startDate = new Date()
    startDate.setMonth(startDate.getMonth()-2)
    startDate.setHours(0,0,0,0)
    let result = await userClient.v2.userTimeline(process.env.ACCOUNT_ID, {expansions: 'attachments.media_keys', 
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
export async function getPossibleCardChoices(exclude) {
    let now = new Date()
    let dateString = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
    const query = `order=cmc&q=c=w+not:reprint+date>${dateString}`
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
            // console.log(face)
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

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

export function generateBlurb(card) {
    let { name } = card
    const dntCreatures = ["Thalia, Guardian of Thraben", "Stoneforge Mystic", "Yorion, Sky Nomad", "Recruiter of the Guard", "Spirit of the Labyrinth",
    "Cathar Commando", "Skyclave Apparition", "Solitude", "Flickerwisp", "Mother of Runes", "Lion Sash", "Timeless Dragon", "Containment Priest", "Ethersworn Canonist",
    "Sanctum Prelate", "Peacekeeper", "Serra Avenger", "Mirran Crusader", "Luminarch Aspirant", "Brightling", "Leonin Relic-Warder", "Hallowed Spiritkeeper"]

    const dntSpells = ["Aether Vial", "Swords to Plowshares", "Umezawa's Jitte", "Batterskull", "Kaldra Compleat", "Council's Judgment"]

    const dntCards = dntCreatures.concat(dntSpells)

    const legacyDecks = ["Delver", "Naya Depths", "Reanimator", "Elves", "Elf", "Moon Stompy", "Doomsday", "8cast", "mirror", "Lands", "Storm", "Sneak and Show", "Painter",
    "Aluren", "Nic Fit", "Death's Shadow", "Blue Pile", "4c Control", "Jeskai", "Miracles", "Burn", "12post", "\"the epic storm\"", "Oops!", "Maverick", "Omnitell",
    "Tempo Doomsday", "Ice Station Zebra", "Eldrazi", "Merfolk", "Pox", "Belcher", "Riddlesmith", "Goblins"]

    const getFirstSentence = () => {
        let responses = [
            `${name} looks like it'll be a new Death and Taxes staple!`,
            `Keep an eye out for ${name} in D&T when ${String.prototype.toUpperCase(card.set)} drops.`,
            `Get your foil ${name}s now, we got a D&T Staple on our hands!`,
            `Does anybody else think ${name} might be playable in Death and Taxes?`,
            `${name} looks like the best D&T card since ${getRandomElement(dntCreatures.concat(dntSpells))}!`,
            `Can't wait to try ${name} in D&T!`,
            `Is it just me or does ${name} look really good in Death and Taxes?`,
            `${name} is the new ${getRandomElement(dntCreatures)}, you heard it here first!`
        ]

        return getRandomElement(responses)
    }

    const getMiddleSentence = () => {
        let responseCategories = []

        let genericResponses = [`It totally changes the ${getRandomElement(legacyDecks)} matchup, and I think it'll really push D&T into the top tier!`,
        `It'll revolutionize our matchup against ${getRandomElement(legacyDecks)}, and it's servicable against Delver too!`,
        `${getRandomElement(legacyDecks)} is a really rough matchup, but ${name} totally turns that around!`,
        `It does a lot of work against ${getRandomElement(legacyDecks)} and ${getRandomElement(legacyDecks)}, without being dead against ${getRandomElement(legacyDecks)}.`,
        `It's a really great reason to play 60 cards, a thing I already really wanted to do (Yorion is just too inconsistent).`,
        `It's obviously an excellent sideboard card, that goes without saying, but I think it might be worth it maindeck as well.`,
        `I hate losing to ${getRandomElement(legacyDecks)} and now, I won't have to!`,
        `It'll be really good in the grindy matchups.`,
        `It looks like the best card ever against any deck with ${getRandomElement(["Brainstorm", "Wasteland", "Dark Ritual", "Daze", "Ancient Tomb", "Green Sun's Zenith"])}.`]

        let recruiterResponses = [`It's a great silver bullet against ${getRandomElement(legacyDecks)}, and looks like a very worthwhile one of maindeck.`,
            `The fact that it's a recruiter target makes it a great sideboard card for ${getRandomElement(["Grindy", "Combo", "Fast", "Slow"])} matchups.`,
            `It's obviously a good card to begin with, but being a recruiter target really pushes it over the edge!`,
            `I can't wait to see the look on my ${getRandomElement(legacyDecks)} opponent's face when I recruiter for it!`,
            `It's a lot better than ${getRandomElement(dntCreatures)} as a recruiter target, which totally changes deck construction!`,
            `I've been looking for more recruiter targets to add, since I absolutely hate playing four of my best cards.`
        ]

        let flickerwispResponses = ['It plays really nicely with Yorion', 'It plays really nice with Flickerwisp', `It's got a great ETB to get people with off of Vial!`,
        `More ETB triggers is always a positive!`, `Looping it with ${getRandomElement(['Flickerwisp', 'Yorion'])} is completely backbreaking against ${getRandomElement(legacyDecks)}`,
        `The ETB looks really nice against ${getRandomElement(legacyDecks)}.`]

        let planeswalkerResponses = [`It's like white's version of ${getRandomElement(['Jace, the Mind Sculptor', 'Minsc and Boo', 'Narset', 'Grist'])}!`,
        'Planeswalkers are always great at beating control decks and this one is no exception!',
        `I've been looking for a good Planeswalker for the board, and this looks way better than Gideon!`]

        responseCategories.push(genericResponses)

        if(card.type_line.search('Creature') >=0 && card.toughness <= 2) {
            responseCategories.push(recruiterResponses)
        }

        if(card.oracle_text.search('enters the battlefield') >= 0) {
            responseCategories.push(flickerwispResponses)
        }

        if(card.type_line.search('Planeswalker') >= 0) {
            responseCategories.push(planeswalkerResponses)
        }

        return getRandomElement(getRandomElement(responseCategories))
    }

    const getClosingSentence = () => {
        let responses = [`It's definitely replacing ${getRandomElement(dntCards)} in my list!`,
            `I'm gonna start out playing ${Math.floor(Math.random() * 4)} but I wouldn't be surprised to end up on 4!`,
            `I'm so excited, I love getting new cards to test!`,
            `I already preordered 4 foils, I'm really confident about this one!`,
            `In a few months they're gonna call it ${name} and Taxes!`,
            `I've preordered ${Math.floor(Math.random() * 25) + 4} copies just in case :)`,
            `It'll probably be my ${getRandomElement(['61st', '81st'])} card.`,
            `I've basically already won my next legacy fnm now that I have it!`,
            `If anybody says this card is bad they're basically harassing me!`,
            `It's basically the new ${getRandomElement(dntCards)}!`,
            `My winrate in magic online practice rooms with this is gonna be astronomical!`,
            `Can't wait to win the next legacy challenge with it :)`,
            `I just wish it had more arts so I could mismatch them :(`,
            `${getRandomElement(dntCards)} has felt mediocre for a while, can't wait to try this out instead!`,
            `I will be maindecking at least 3 copies.`,
            `If you don't play 4 your deck is terrible and I hate you.`,
            `I can't wait to laugh at all the haters in six months when this wins every legacy challenge.`,
            
        ]

        return getRandomElement(responses)
    }

    return `${getFirstSentence()} ${getMiddleSentence()}

${getClosingSentence()}${Math.random() * 10 > 9 ? "\n\nAlso, watch The Owl House" : ''}`
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
        return null;
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
    let blurb = generateBlurb(['transform', 'modal_dfc'].includes(card.layout)? {...card, ...card.card_faces[0]} : card)
    await userClient.v2.tweet({
        text: blurb,
        media: {
            media_ids: newMediaIDs
        }
    })
    console.log(`Successfully tweeted about ${card.name} being D&T playable`)

    return null;
}