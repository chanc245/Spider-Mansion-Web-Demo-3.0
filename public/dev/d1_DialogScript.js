/*
VISUAL
bg — background image path (including cg)
charCG — character sprite image path
bgTall — mark this bg as a tall "long CG" (height*2) that the camera can scroll
bgPan — animate the long-CG camera: "bottom" (scroll down) or "top" (scroll up)

TEXT
charName — name shown in the nameplate (blank/space = narrator, no nameplate)
text — the dialogue/narration text

AUDIO
soundEffect — plays via AudioManager (BGM, ambience, one-shot SFX)
loopSound — when true, the line's soundEffect loops until stopped (default one-shot)
stopSound — stops a sound; can be a path string or { path, fadeMs }
fadeSoundMs — fade duration in ms when used alongside stopSound
diaAudio — voiceover file for this line (plays on the isolated private channel)

BRANCHING
option.branchId — when set, sketch.js handles routing instead of resumeFromOption()
*/

// ALL SCRIPTS — Day 1
// d1_vnScript_morning         → up to the leave/investigate branch
// d1_vnScript_kitchen         → shared by both morning branches
// d1_vnScript_lunch
// d1_vnScript_afternoon_pre   → ends when kitchen investigation starts
// d1_vnScript_afternoon_post  → after Cook kicks you out
// d1_vnScript_dinner_pre      → linear VN before character options loop
// d1_dinner_characters        → data for the dinner DIA_OPTION loop
// d1_vnScript_dinner_post
// d1_vnScript_night_pre       → before music search
// d1_vnScript_night_dining    → after finding the dining room, before quiz
// d1_vnScript_night_postQuiz  → after quiz resolves

// ─── MORNING ──────────────────────────────────────────────────────────────────

const d1_vnScript_morning = [
  {
    charName: " ",
    bg: "assets/bg/bg_BlackOut.png",
    soundEffect: "assets/audio/sfx/dia_birdChatter.mp3",
    // Day 0's looping BGM is still playing here — fade it out as Day 1 begins.
    stopSound: "assets/audio/bgm/bg_ara.mp3",
    fadeSoundMs: 1500,
    text: "You awaken to the sound of birds chattering outside your window. You realize it is time to do your duty – wake Eva up.",
  },
  {
    charName: " ",
    bg: "assets/bg/bg_pa_3f_Attic.png",
    text: "Eva is still peacefully asleep in her bed. Sensing the gentle awakening from you, she pulls the blanket up to hide herself slightly beneath it.",
  },
  {
    charName: " ",
    text: "You quietly open the curtains. The bright sunlight streams into the room.",
  },
  {
    charName: " ",
    text: "The light rouses Eva, who slowly wakes up and rubs her eyes, still half-asleep.",
  },
  {
    option: {
      choices: [
        {
          label: "Waking Eva up",
          text: "Eva is still peacefully asleep in her bed. Sensing the gentle awakening from you, she pulls the blanket up to hide herself slightly beneath it.",
        },
        {
          label: "Open the curtains",
          text: "You quietly open the curtains, the bright sunlight streams into the room.",
        },
      ],
    },
  },
  {
    charName: "Eva",
    charCG: "assets/charImg/char_eva_sleepy.png",
    text: "Okay, okay, I'm awake.",
  },
  {
    charName: " ",
    charCG: "assets/charImg/char_eva_sleepy.png",
    soundEffect: "assets/audio/sfx/dia_evaSmallYawn.mp3",
    text: "Eva responds with a small yawn, still appearing a bit sleepy.",
  },
  {
    charName: " ",
    text: "You help her wash her face and get dressed.",
  },
  {
    charName: " ",
    bg: "assets/cg/event/cg_d101_paam_BrushHair.png",
    text: "Letting her sit in front of the mirror, you carefully comb her silky, long blonde hair, which is as light and delicate as a spider web.",
  },
  {
    charName: " ",
    text: "As you comb, you notice how fragile she looks, with a small body that doesn't resemble a lady living in a wealthy mansion.",
  },
  {
    charName: " ",
    text: "Instead, she appears more like a young maid deprived of nutritious meals, her slight frame making her seem younger than her age.",
  },
  {
    charName: " ",
    text: "You suddenly feel a pair of eyes on you and realize that Eva is watching you through the reflection in the mirror.",
  },
  {
    charName: " ",
    bg: "assets/cg/event/cg_d102_paam_BrushHairEvaBlush.png",
    text: "Caught in the moment, she has a look of embarrassment on her face.",
  },
  {
    charName: " ",
    soundEffect: "assets/audio/sfx/dia_evaStomachGrowls.mp3",
    text: "Just as you open your mouth to apologize, Eva's stomach growls loudly.",
  },
  {
    charName: "Eva",
    text: "...",
  },
  {
    charName: " ",
    text: "You check the time and realize it's almost time for a meal, but the food hasn't arrived in Eva's room yet.",
  },
  {
    charName: "Eva",
    bg: "assets/bg/bg_pa_3f_Attic.png",
    charCG: "assets/charImg/char_eva_smiling.png",
    text: "Oh, it's fine. I'm not really hungry. I can just skip the meal.",
  },
  {
    charName: " ",
    charCG: "assets/charImg/char_eva_smiling.png",
    text: "She says with a smile, but her growling stomach tells a different story.",
  },
  {
    charName: " ",
    charCG: "assets/charImg/char_eva_smiling.png",
    text: "You realize the cook must've forgotten the meal. You tell Eva you'll fetch the food from the kitchen.",
  },
  {
    charName: "Eva",
    charCG: "assets/charImg/char_eva_smiling.png",
    text: "You, you don't have to… but if you say so.",
  },
  {
    charName: " ",
    charCG: "assets/charImg/char_eva_smiling.png",
    text: "You head straight to the kitchen.",
  },
  // Morning ends → sketch.js continues to the kitchen (d1_vnScript_kitchen).
];

// ─── KITCHEN (morning, shared by both branches) ───────────────────────────────

const d1_vnScript_kitchen = [
  {
    charName: " ",
    bg: "assets/bg/bg_pa_1f_Kitchen.png",
    text: "You enter the kitchen and find the cook preparing a meal. On the table, you see a well-made dish.",
  },
  {
    charName: " ",
    charCG: "assets/charImg/char_cook_annoyed.png",
    text: "When you reach for the plate, Cook Harris yells at you aggressively.",
  },
  {
    charName: "Cook",
    charCG: "assets/charImg/char_cook_annoyed.png",
    text: "Hey! What do you think you're touching with your filthy hands?",
  },
  {
    charName: " ",
    charCG: "assets/charImg/char_cook_angry.png",
    text: "You explain that you came for Lady Eva's meal.",
  },
  {
    charName: "Cook",
    charCG: "assets/charImg/char_cook_annoyed.png",
    text: "Ah right, you're that newbie who's that girl's nanny. You know, that girl doesn't really prefer to eat around this early.",
  },
  // Both choices converge at the same Cook response — purely flavor.
  {
    option: {
      choices: [
        {
          label: "Tell him you still want to bring the meal",
          text: "You tell Cook Harris you still want to bring the meal.",
        },
        {
          label: "Tell him Eva seemed hungry",
          text: "You tell Cook Harris that Eva seemed to be hungry.",
        },
      ],
    },
  },
  {
    charName: "Cook",
    charCG: "assets/charImg/char_cook_annoyed.png",
    text: "Then bring those leftovers or whatever.",
  },
  {
    charName: " ",
    charCG: "assets/charImg/char_cook_angry.png",
    text: "Cook Harris points at a bucket filled with inedible scraps.",
  },
  {
    charName: " ",
    charCG: "assets/charImg/char_cook_angry.png",
    text: "You feel disgusted. Both by the food and Cook Harris's reaction.",
  },
  {
    charName: "Cook",
    charCG: "assets/charImg/char_cook_annoyed.png",
    text: "Bring that food or get out of my face. I have to serve this gorgeous meal to the master.",
  },
  {
    charName: " ",
    text: "The cook leaves the room with a well-decorated plate, clearly intended for Eva's father.",
  },
  {
    charName: " ",
    text: "Determined not to serve that garbage to Eva, you decide to prepare a fresh meal using ingredients in the kitchen.",
  },
  {
    charName: " ",
    text: "There must be some edible ones if you look around.",
  },
  {
    charName: " ",
    text: "After looking around, you decide to cook some soup with the very limited ingredients you have found.",
  },
  // sketch.js starts PA_GAME here when this script finishes
];

// ─── POST-COOK (after the kitchen mini-game) ───────────────────────────────────
// Plays right after PA_GAME finishes, then hands off to the lunch script.

const d1_vnScript_postCook = [
  {
    charName: " ",
    bg: "assets/bg/bg_pa_1f_Kitchen.png",
    text: "It looks like a successful cook. The soup seems pretty delicious.",
  },
];

// ─── LUNCH ────────────────────────────────────────────────────────────────────

const d1_vnScript_lunch = [
  {
    charName: " ",
    bg: "assets/bg/bg_pa_3f_Attic.png",
    text: "You bring the meal up to Eva's room.",
  },
  {
    // Eva first appears here (she's seen in the room) and stays on screen for
    // the rest of the conversation. keepCG holds her across the narration lines.
    charName: " ",
    charCG: "assets/charImg/char_eva_smiling.png",
    soundEffect: "assets/audio/bgm/bg_eva.mp3",
    loopSound: true,
    text: "You see Eva holding a book while a music box slowly turns beside her. Instead of reading, she gazes into a corner of her room, her mind seemingly wandering off somewhere.",
  },
  {
    charName: " ",
    keepCG: true,
    text: "You follow her gaze to the corner and find it covered in dust and spiderwebs.",
  },
  {
    charName: " ",
    keepCG: true,
    text: "Before you can call her, she catches the smell of food and turns to you.",
  },
  {
    charName: " ",
    charCG: "assets/charImg/char_eva_happy.png",
    stopSound: "assets/audio/bgm/bg_eva.mp3",
    fadeSoundMs: 5000,
    text: "Her face brightens with a smile, looking more excited to see you than the food itself.",
  },
  {
    charName: "Eva",
    charCG: "assets/charImg/char_eva_happy.png",
    text: "Wow, you came back! I didn't expect you to actually bring something. Thank you so much!",
  },
  {
    charName: " ",
    keepCG: true,
    text: "You ask her what she was looking at in that corner, and she suddenly looks a little sad.",
  },
  {
    charName: "Eva",
    charCG: "assets/charImg/char_eva_smiling.png",
    text: "I had a friend who also really liked a corner like that...",
  },
  {
    charName: "Eva",
    bg: "assets/cg/event/cg_d103_paam_HappyEatingEva.png",
    // charCG: "assets/charImg/char_eva_happy.png",
    text: "Wow, this tastes so great! Thank you. It's been a while since I had a nice meal like this.",
  },
  {
    charName: " ",
    keepCG: true,
    text: "You ask what she means.",
  },
  {
    charName: "Eva",
    // charCG: "assets/charImg/char_eva_smiling.png",
    text: "Oh… I mean, I haven't been receiving any food for lunch until you came.",
  },
  {
    charName: " ",
    keepCG: true,
    bg: "assets/bg/bg_pa_3f_Attic.png",
    charCG: "assets/charImg/char_eva_smiling.png",
    text: "Eva's voice lowers as she speaks, and she looks a little guilty as well.",
  },
  {
    charName: " ",
    keepCG: true,
    charCG: "assets/charImg/char_eva_smiling.png",
    text: "You already have a feeling why Eva didn't eat Cook Harris's meal after seeing what he showed you.",
  },
  {
    charName: " ",
    keepCG: true,
    charCG: "assets/charImg/char_eva_smiling.png",
    text: "You think back to what Cook Harris said. He seemed to be ignoring Eva's existence entirely.",
  },
  {
    charName: "Eva",
    charCG: "assets/charImg/char_eva_happy.png",
    text: "It is true that I didn't eat the meal Mr. Harris prepared for me.",
  },
  {
    charName: "Eva",
    charCG: "assets/charImg/char_eva_happy.png",
    text: "As I haven't touched food for a while, Mr. Harris probably thinks I'm not hungry.",
  },
  {
    charName: "Eva",
    charCG: "assets/charImg/char_eva_happy.png",
    text: "So I don't mind too much! I'm fine with it.",
  },
  {
    charName: " ",
    keepCG: true,
    text: "You sense there might be more to Eva's situation after witnessing Cook Harris's attitude. You consider asking her about it.",
  },
  // Both choices converge — flavor only.
  {
    option: {
      choices: [
        {
          label: "Ask if the cook's food made her uncomfortable",
          text: "You ask Eva if the cook's treatment had been making her uncomfortable.",
        },
        {
          label: "Tell her you worry about her",
          text: "You tell her you worry about her.",
        },
      ],
    },
  },
  {
    charName: "Eva",
    charCG: "assets/charImg/char_eva_smiling.png",
    text: "Thanks for being thoughtful of me. But I'm really fine!",
  },
  {
    charName: " ",
    keepCG: true,
    text: "Eva responds with a smile. It seems rather reluctant.",
  },
  {
    charName: " ",
    keepCG: true,
    text: "Despite your concern for Eva's well-being, you decide to give her some space and wait patiently for her to finish her meal.",
  },
];

// ─── AFTERNOON ────────────────────────────────────────────────────────────────

// Plays before the kitchen investigation state.
const d1_vnScript_afternoon_pre = [
  {
    charName: " ",
    bg: "assets/bg/bg_pa_3f_Attic.png",
    charCG: "assets/charImg/char_eva_happy.png",
    text: "Eva finished her meal and looked happy.",
  },
  {
    charName: " ",
    keepCG: true,
    text: "Now it's time for you to attend to your duties as a nanny. You gather the finished plate and prepare to take it back to the kitchen.",
  },
  {
    charName: "Eva",
    charCG: "assets/charImg/char_eva_smiling.png",
    text: "I'll be in my room reading books.",
  },
  {
    // Eva's sprite is intentionally dropped here (no charCG / no keepCG): the bg
    // moves to the kitchen, so she leaves the frame as the player walks away.
    charName: " ",
    bg: "assets/bg/bg_pa_1f_Kitchen.png",
    text: "You tidy her room up a bit and bring the plates back down to the kitchen.",
  },
  // sketch.js starts PA_WEB_INVESTIGATE (kitchen) when this script finishes
];

// Plays after the kitchen investigation (Cook kicks you out).
const d1_vnScript_afternoon_post = [
  {
    charName: "Cook",
    charCG: "assets/charImg/char_cook_angry.png",
    bg: "assets/bg/bg_pa_1f_Kitchen.png",
    text: "Hey you! What are you doing here? Be gone if you're done with your chores!",
  },
  {
    charName: " ",
    text: "You were kicked out of the kitchen.",
  },
  {
    charName: " ",
    text: "…",
  },
  {
    charName: " ",
    bg: "assets/bg/bg_BlackOut.png",
    text: "After doing some more chores, it's already time for dinner, so you quickly head to the dining room.",
  },
];

// ─── DINNER ───────────────────────────────────────────────────────────────────

// Linear VN before the character-options loop starts.
const d1_vnScript_dinner_pre = [
  {
    charName: " ",
    bg: "assets/bg/bg_pa_1f_Dining.png",
    text: "The Von Silken family has a tradition that everyone must gather in the dining room to eat dinner together.",
  },
  {
    charName: " ",
    text: "All the workers must be present as well, standing by the wall and ready to serve.",
  },
  {
    charName: " ",
    text: "You quietly stand alongside the other servants.",
  },
  {
    charName: "Master",
    charCG: "assets/charImg/char_lucius_annoyed.png",
    text: "Why is the food taking so long?",
  },
  {
    charName: "Lady Master",
    charCG: "assets/charImg/char_rosa_normal.png",
    text: "Why don't you try to be more patient?",
  },
  {
    charName: "Master",
    charCG: "assets/charImg/char_lucius_annoyed.png",
    text: "Huh, what do you mean? I AM patient.",
  },
  {
    charName: "Mistress",
    charCG: "assets/charImg/char_emme_smile.png",
    text: "Honey, the food will come soon if we wait a little longer. Let's be understanding.",
  },
  {
    charName: "Master",
    charCG: "assets/charImg/char_lucius_smile.png",
    text: "Hmm, sure my dear. It'll come any second.",
  },
  // sketch.js starts the dinner DIA_OPTION loop when this script finishes
];

// Each entry's `script` plays as DIA_VN when that character is chosen.
// sketch.js loops through this until "Return to position" is picked.
const d1_dinner_characters = [
  {
    id: "ladyMaster",
    label: "Lady Master",
    script: [
      {
        charName: "Lady Master",
        bg: "assets/bg/bg_pa_1f_Dining.png",
        text: "Take care of that little girl, since her real mother doesn't seem to care.",
      },
    ],
  },
  {
    id: "mistress",
    label: "Mistress",
    script: [
      {
        charName: " ",
        bg: "assets/bg/bg_pa_1f_Dining.png",
        text: "(She's not interested in you. She's focused on talking to the Master.)",
      },
    ],
  },
  {
    id: "master",
    label: "Master",
    script: [
      {
        charName: " ",
        bg: "assets/bg/bg_pa_1f_Dining.png",
        text: "(He's not interested in you; he's focused on talking to the Mistress.)",
      },
    ],
  },
  {
    id: "eva",
    label: "Eva",
    script: [
      {
        charName: "Eva",
        charCG: "assets/charImg/char_eva_happy.png",
        bg: "assets/bg/bg_pa_1f_Dining.png",
        text: "Look! I usually get a good meal for dinner.",
      },
      {
        charName: " ",
        text: "Eva looks at you and gives you a bright smile.",
      },
      {
        charName: " ",
        text: "You observed her food quality is slightly worse than the others', but you don't mention it.",
      },
    ],
  },
  {
    id: "cook",
    label: "Cook",
    script: [
      {
        charName: "Cook",
        charCG: "assets/charImg/char_cook_normal.png",
        bg: "assets/bg/bg_pa_1f_Dining.png",
        text: "If I don't serve that little girl's meal even in front of Master Von Silken, it will seem too obvious.",
      },
    ],
  },
  {
    id: "gardener",
    label: "Gardener",
    script: [
      {
        charName: "Gardener",
        bg: "assets/bg/bg_pa_1f_Dining.png",
        text: "Brother is right. Even though everyone is ignoring her, we still have to treat her somewhat like royalty.",
      },
    ],
  },
  {
    id: "headMaid",
    label: "Head Maid",
    script: [
      {
        charName: "Head Maid",
        bg: "assets/bg/bg_pa_1f_Dining.png",
        text: "Stop wandering around and stay in your position!",
      },
      {
        charName: "Head Maid",
        text: "(mumbling) And every night, I still cannot understand why everyone needs to be in this dinner place while I could be resting. Instead, we are just watching them eat…",
      },
    ],
  },
];

const d1_vnScript_dinner_post = [
  {
    charName: " ",
    bg: "assets/bg/bg_BlackOut.png",
    text: "After cleaning the kitchen, you have your own meal and fall asleep.",
  },
];

// ─── NIGHT ────────────────────────────────────────────────────────────────────

// Plays before PR_MUSIC_SEARCH.
const d1_vnScript_night_pre = [
  {
    charName: " ",
    bg: "assets/bg/bg_BlackOut.png",
    // Music box starts here and loops through the search + into the dining room.
    soundEffect: "assets/audio/bgm/bg_ara_short.mp3",
    text: "You wake to the sound of a music box playing.",
  },
  {
    charName: "You",
    text: "What is that sound from the hallway?",
  },
  {
    charName: " ",
    text: "The sound of the music box was quite distant, echoing in the empty hallway and giving an eerie vibe.",
  },
  {
    charName: "You",
    text: "I should go check where the sound is coming from.",
  },
  // sketch.js starts PR_MUSIC_SEARCH when this script finishes
];

// Plays after the correct room is found. Ends when sketch.js starts the Day 1 quiz.
const d1_vnScript_night_dining = [
  {
    charName: " ",
    bg: "assets/bg/bg_pr_1f_Dining.png",
    text: "As you enter the dining room you see a music box placed on top of the fireplace. It seems that the melody that brought you here was coming from there.",
  },
  {
    charName: "Eva",
    charCG: "assets/charImg/char_ara_smiling.png",
    text: "You're awake. I've been waiting for you.",
    diaAudio: "d1_dia_01.mp3",
  },
  {
    charName: " ",
    bg: "assets/bg/bg_pr_1f_DinningRoom_cg.png",
    text: "Eva is seated in the master's chair, with a silver dish cover in front of her. Across the table, you notice another covered dish.",
  },
  {
    charName: "Eva",
    // Music box stops as she invites the player to sit.
    stopSound: "assets/audio/bgm/bg_ara_short.mp3",
    fadeSoundMs: 800,
    text: "Please, take a seat in front of me. I've prepared a meal for you as well.",
    diaAudio: "d1_dia_02.mp3",
  },
  {
    charName: " ",
    text: "Eva said with a smile on her face. Unlike the bright and soft smile you saw in the morning, under the moonlight, this smile seems a bit... off.",
  },
  {
    charName: " ",
    // charCG: "assets/charImg/char_ara_smiling.png",
    soundEffect: "assets/audio/sfx/dia_evaStomachGrowls.mp3",
    text: "Before you can think more into that idea, somehow, you feel a strong hunger, as if you haven't eaten all day. You sit across from Eva's seat.",
  },
  {
    charName: "Eva",
    // charCG: "assets/charImg/char_ara_smiling.png",
    // Switch to the tall dining "long CG" and pan the camera down to the dish.
    bg: "assets/quiz/bg_quiz_day1_dinningRoom.png",
    bgTall: true,
    bgPan: "bottom",
    text: "Go on, you must be hungry.",
    diaAudio: "d1_dia_03.mp3",
  },
  {
    charName: " ",
    // Event CG (full-screen bg): your hand reaching for the cover, a muddy
    // reflection of yourself in it. Replaces the tall dining CG for this beat;
    // Eva's interruption below restores the dining view.
    bg: "assets/cg/event/cg_d104_prpm_ReachReflection.png",
    text: "Somehow, you don't feel this is a good choice. Your hand trembles as it reaches for the cover.",
  },
  // Both choices converge — Ara interrupts either way.
  {
    option: {
      choices: [
        { label: "Open the cover", text: "You reach for the cover." },
        {
          label: "Don't open the cover",
          text: "You hesitate, hand hovering over it.",
        },
      ],
    },
  },
  {
    charName: "Eva",
    // Restore the dining view after the reflection CG: re-assert the tall dining
    // CG with the camera at the top (on Eva).
    bg: "assets/quiz/bg_quiz_day1_dinningRoom.png",
    bgTall: true,
    bgPan: "top",
    text: "Ah, I almost forgot! Remember the quiz game we promised to do?",
    diaAudio: "d1_dia_04.mp3",
  },
  {
    charName: " ",
    // charCG: "assets/charImg/char_ara_smiling.png",
    text: "You're interrupted in the middle of reaching for the cover. You feel relieved not to have opened it.",
  },
  {
    charName: " ",
    // charCG: "assets/charImg/char_ara_smiling.png",
    text: "You briefly recall the promise made last night.",
  },
  // sketch.js starts D1_QUIZ when this script finishes
];

// Plays after the Day 1 quiz is solved.
// Shared tail — identical for both quiz outcomes. The only difference between
// getting the quiz right vs. wrong is the opening lines (see _Good / _Bad below),
// mirroring how Day 0 branches into postQuiz_Good / postQuiz_Bad.
const d1_vnScript_night_postQuiz_tail = [
  // Both choices have the same outcome — Ara opens hers regardless.
  {
    option: {
      choices: [
        {
          label: "Open the cover",
          text: "You reach for the cover and lift it.",
        },
        {
          label: "Don't open the cover",
          text: "Before you can decide, Eva lifts hers.",
        },
      ],
    },
  },
  // ── Event CGs (shown as full-screen bg, like Day 0) ───────────────
  // The dining bg carries the first two narration lines; the decomposed-bird
  // reveal switches to cg_d106, then cg_d105 (Ara's side) holds through her
  // commentary until cg_d107 takes over at the lunge. bg persists between
  // lines automatically, so no per-line flag is needed.
  {
    charName: " ",
    text: "Before even inspecting the contents, you detect a strong rotting odor.",
  },
  {
    charName: " ",
    text: "With a disgusted expression on your face, you feel nauseated and cover your nose.",
  },
  {
    charName: " ",
    // Event CG (bg): the decomposed-bird reveal.
    bg: "assets/cg/event/cg_d106_prpm_RottenFood.png",
    text: "Underneath the cover is a decomposed bird, clearly left untouched for at least a week.",
  },
  {
    charName: " ",
    // Event CG (bg): Ara's side profile. Persists as the background through her
    // commentary below until cg_d107.
    bg: "assets/cg/event/cg_d105_prpm_AraSide.png",
    text: "You avoid eye contact with the dead bird and instead glance at Eva, sensing a slight feeling of blame towards her for the situation.",
  },
  {
    charName: " ",
    text: "However, her eyes appear lifeless, conveying only an endless abyss of darkness.",
  },
  {
    charName: " ",
    text: "You feel something is off. You realize there are no bugs or flies around the body. The room is eerily quiet, with no signs of life other than you and the unnervingly calm girl in front of you.",
  },
  {
    charName: "Eva",
    text: "Eva used to be served this kind of food. Can you even call that person a competent cook?",
    diaAudio: "d1_dia_05.mp3",
  },
  {
    charName: "Eva",
    text: "He's just an egotist who is cruel to the weak and submissive to the strong.",
    diaAudio: "d1_dia_06.mp3",
  },
  {
    charName: " ",
    text: "Then Eva poked the bird's wing with a fork and attempted to take a bite of the dead bird.",
  },
  {
    charName: " ",
    text: "When you see the scene, your instincts kick in, and you rush over to stop her abruptly.",
  },
  // ── Event CG: cg_d107 AraEat (bg) ─────────────────────────────────
  // You lunge to stop her; her grotesque smile. Persists as the background to
  // the end of the scene — the black-out line below drops it for a clean fade.
  {
    charName: " ",
    bg: "assets/cg/event/cg_d107_prpm_AraEat.png",
    text: "Your sudden, unexpected action surprises Eva. She then gives a satisfied grotesque smile.",
  },
  {
    charName: "Eva",
    text: "At least you care. Unlike that cook.",
    diaAudio: "d1_dia_07.mp3",
  },
  {
    charName: "Eva",
    text: "...",
  },
  {
    charName: "Eva",
    text: "You should go to sleep soon. You must be tired.",
    diaAudio: "d1_dia_08.mp3",
  },
  {
    charName: " ",
    text: "You don't feel tired, but rather a headache from experiencing so much.",
  },
  {
    charName: "Eva",
    text: "I'll look forward to tomorrow's quiz.",
    diaAudio: "d1_dia_09.mp3",
  },
  {
    charName: " ",
    bg: "assets/bg/bg_BlackOut.png",
    text: "You decide to clean up the mess, escort Eva to her room, and end your day.",
  },
  // sketch.js transitions to END (or Day 2) when this script finishes
];

// Got the quiz right — Ara is pleased.
const d1_vnScript_night_postQuiz_Good = [
  {
    charName: "Eva",
    charCG: "assets/charImg/char_ara_smiling.png",
    bg: "assets/bg/bg_pr_1f_Dining.png",
    text: "Good that you got this right. As a prize, I'll allow you to open the cover. Bon appétit.",
    diaAudio: "d1_dia_g01.mp3",
  },
  ...d1_vnScript_night_postQuiz_tail,
];

// Got the quiz wrong — Ara lets it pass, but her tone is colder. (Placeholder
// wording — slightly "off" like Day 0's bad path; edit freely.)
const d1_vnScript_night_postQuiz_Bad = [
  {
    charName: "Eva",
    charCG: "assets/charImg/char_ara_blank.png",
    bg: "assets/bg/bg_pr_1f_Dining.png",
    text: "...",
  },
  {
    charName: " ",
    charCG: "assets/charImg/char_ara_blank.png",
    bg: "assets/bg/bg_pr_1f_Dining.png",
    text: "She stared at you in silence for a moment too long. Your blood ran cold.",
  },
  {
    charName: "Eva",
    charCG: "assets/charImg/char_ara_normal.png",
    bg: "assets/bg/bg_pr_1f_Dining.png",
    text: "...Not quite. But it doesn't matter. I'll allow you to open the cover anyway. Bon appétit.",
    diaAudio: "d1_dia_b01.mp3",
  },
  ...d1_vnScript_night_postQuiz_tail,
];

// Back-compat alias — defaults to the "good" path.
const d1_vnScript_night_postQuiz = d1_vnScript_night_postQuiz_Good;
