import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1";



env.allowLocalModels = false;



let classifier = null;



async function init() {

  classifier = await pipeline('audio-classification', 'Xenova/ast-finetuned-audioset-10-10-0.4593');

  self.postMessage({ type: 'ready' });

}



self.onmessage = async (e) => {

  if (e.data.type === 'init') {

    await init();

  } else if (e.data.type === 'analyze') {

    // Le Worker reçoit les données audio brutes

    const audioData = e.data.audioData;

   

    const results = await classifier(audioData);

   

    const strictGenres = ["pop", "rock", "electronic", "techno", "house", "trance", "dubstep", "hip hop", "rap", "jazz", "blues", "classical", "metal", "punk", "reggae", "country", "folk", "soul", "funk", "disco", "ambient", "rhythm and blues", "indie", "gospel"];

   

    const bestMatch = results.find(item =>

      strictGenres.some(genre => item.label.toLowerCase().includes(genre))

    );

    console.log();

    self.postMessage({

      type: 'result',

      theme: bestMatch ? bestMatch.label.replace(" music", "") : null,

      score: bestMatch ? bestMatch.score : 0

    });

  }

};