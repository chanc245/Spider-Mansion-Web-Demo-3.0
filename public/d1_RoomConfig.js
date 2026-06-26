// d1_RoomConfig.js
// Day 1 room/object data for the spider-web investigation scenes.
// Plain content (like the dialog scripts); consumed by sketch.js + debug.js.

// ─── Kitchen investigation config ────────────────────────────────
// Positions and asset paths match the spider-web investigation art.
const D1_KITCHEN_OBJECTS = [
  {
    name: "window",
    imgLine: "assets/inv_obj/day1_kitchen/obtLine_ktcn_01_Window.png",
    imgFull: "assets/inv_obj/day1_kitchen/obt_ktcn_01_Window.png",
    img: { x: 483, y: 104, w: 123, h: 106.66 },
    text: "The window is open, letting in a slight breeze.",
  },
  {
    name: "ashes",
    imgLine: "assets/inv_obj/day1_kitchen/obtLine_ktcn_02_Ashes.png",
    imgFull: "assets/inv_obj/day1_kitchen/obt_ktcn_02_Ashes.png",
    img: { x: 270, y: 421, w: 41, h: 28 },
    text: "You notice ashes on the ground. They smell like more than just burnt food; there's something else in the scent.",
  },
  {
    name: "cigarette butts",
    imgLine: "assets/inv_obj/day1_kitchen/obtLine_ktcn_03_CigaretteButt.png",
    imgFull: "assets/inv_obj/day1_kitchen/obt_ktcn_03_CigaretteButt.png",
    img: { x: 306, y: 401, w: 39, h: 24 },
    text: "You find cigarette butts on the floor. Master Von Silken won't be pleased if he finds out Cook Harris is smoking in the kitchen. The smell is strong and herbal.",
  },
  {
    name: "cigarette box",
    imgLine: "assets/inv_obj/day1_kitchen/obtLine_ktcn_04_CigeretteBox.png",
    imgFull: "assets/inv_obj/day1_kitchen/obt_ktcn_04_CigeretteBox.png",
    img: { x: 859, y: 371, w: 60, h: 33 },
    text: "A doctor's note reads: \"If you smoke too often, your sense of taste and smell may become dull.\"",
  },
  {
    name: "recipe book",
    imgLine: "assets/inv_obj/day1_kitchen/obtLine_ktcn_05_RecipeBook.png",
    imgFull: "assets/inv_obj/day1_kitchen/obt_ktcn_05_RecipeBook.png",
    img: { x: 510, y: 213, w: 70, h: 58.17 },
    text: "You see a book near the window, its pages fluttering in the wind.",
    subOptions: [
      { label: "Read the book",  text: "There are no pictures at all. Instead, you see extremely detailed notes about flavors — so detailed they almost feel unnatural." },
      { label: "Close the book", text: "The cover shows that it is a recipe book." },
    ],
  },
  {
    name: "ingredients",
    imgLine: "assets/inv_obj/day1_kitchen/obtLine_ktcn_06_Ingredients.png",
    imgFull: "assets/inv_obj/day1_kitchen/obt_ktcn_06_Ingredients.png",
    img: { x: 387, y: 299, w: 166, h: 86 },
    text: "All the ingredients are in good condition. You've heard he uses only high-quality produce. Not for Eva, though.",
  },
  {
    name: "pot",
    imgLine: "assets/inv_obj/day1_kitchen/obtLine_ktcn_07_Pot.png",
    imgFull: "assets/inv_obj/day1_kitchen/obt_ktcn_07_Pot.png",
    img: { x: 317, y: 224, w: 57, h: 66 },
    text: "There is leftover soup in the pot.",
    subOptions: [
      { label: "Taste the soup", text: "You dip your finger in and taste the soup. … It tastes subtle… Anyone who takes a bite can't help but frown at the strange, uncanny flavor." },
      { label: "Step away",      text: "You step away from the pot." },
    ],
  },
];

const D1_KITCHEN_WEB_CONFIG = {
  bg: "assets/bg/bg_pa_1f_Kitchen.png",
  webCenter: { x: 545, y: 208 },
  objects: D1_KITCHEN_OBJECTS,
};

// Attic objects — same mechanic as the kitchen. One clickable object for now;
// add more (bed, bookshelf) once their overlay art exists. Objects with no
// imgLine/imgFull still work: the spider-web threads + hotspot make them
// clickable, they just don't draw an overlay highlight yet.
const D1_ATTIC_OBJECTS = [
  {
    name: "music box",
    // imgLine / imgFull: add when attic overlay art is ready.
    img: { x: 95, y: 150, w: 110, h: 70 }, // on the dresser, left side
    text: "A delicate, round-looking music box that seems to have been taken very carefully care of. This might be the most expensive item you can see in this room.",
  },
  // { name: "bed",       img: { x:0,y:0,w:0,h:0 }, text: "A narrow daybed that looks very uncomfortable to sleep on; the bedsheet is clean but worn out." },
  // { name: "bookshelf", img: { x:0,y:0,w:0,h:0 }, text: "An old, large bookshelf with only a few items on it: a handful of books that seem a little worn out." },
];

const D1_ATTIC_WEB_CONFIG = {
  bg: "assets/bg/bg_pa_3f_Attic.png",
  webCenter: { x: 512, y: 288 },               // placeholder
  objects: D1_ATTIC_OBJECTS,
};
