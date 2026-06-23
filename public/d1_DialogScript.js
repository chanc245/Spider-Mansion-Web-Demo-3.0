/*
VISUAL
bg — background image path (including cg)
charCG — character sprite image path

TEXT
charName — name shown in the nameplate (blank/space = narrator, no nameplate)
text — the dialogue/narration text

AUDIO
soundEffect — plays via AudioManager (BGM, ambience, one-shot SFX)
stopSound — stops a sound; can be a path string or { path, fadeMs }
fadeSoundMs — fade duration in ms when used alongside stopSound
diaAudio — voiceover file for this line (plays on the isolated private channel)
*/

// ALL SCRIPTS
// - d1_vnScript_morning
// - d1_vnScript_lunch
// - d1_vnScript_afternoon
// - d1_vnScript_dinner
// - d1_vnScript_night

// const exampleString = [
//   {
//     charName: " ",
//     charCG: "assets/charImg/char_ara_smiling.png",
//     bg: "assets/bg/bg_BlackOut.png",
//     text: "",
//     diaAudio: "d0_dia_01.mp3",
//     soundEffect: "assets/audio/dia_step.mp3",
// },
// ];

const d1_vnScript_morning = [
  {
    charName: " ",
    bg: "assets/bg/bg_BlackOut.png",
    text: "You awaken to the sound of birds chattering outside your window. You realize it is time to do your duty – wake Eva up.",
    soundEffect: "assets/audio/dia_birdChatter.mp3",
  },
  {
    charName: " ",
    // charCG: "assets/charImg/char_ara_smiling.png",
    bg: "assets/bg/bg_pr_3f_Attic.png",
    text: "Eva is still peacefully asleep in her bed. Sensing the gentle awakening from you, she pulls the blanket up to hide herself slightly beneath it.",
    diaAudio: "d0_dia_01.mp3",
    soundEffect: "assets/audio/dia_step.mp3",
  },
  {
    option: {
      prompt: "What do you do?",
      choices: [
        { label: "Wake Eva gently", text: "You softly call her name." },
        { label: "Open the curtains", text: "You quietly open the curtains." },
      ],
    },
  },
  {
    charName: " ",
    // charCG: "assets/charImg/char_ara_smiling.png",
    bg: "assets/bg/bg_pr_3f_Attic.png",
    text: "",
    diaAudio: "d0_dia_01.mp3",
    soundEffect: "assets/audio/dia_step.mp3",
  },
];
