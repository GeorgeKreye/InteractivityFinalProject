/*
  For my final project, I combined aspects of exercises 3 and 5 to create a sandbox simulation in the vein of games like the open-source Powder Toy. The user is intended to place particles on a grid-like canvas which are subject to physics. The system used here is skeletal, with two solids and a static wall being implemented by default. By enabling experimental features, however, the ability to change brush size and place water is enabled, though they (currently) have some bugs associated with them and their behavior that make me consider them not finished.
  
  The system is designed to be modular, with adding new materials just requiring writing a small class and any behaviors the mateiral is to have. There is room for up to 10 materials, all mapped to the number keys. This version doesn't have a visual GUI, but a more polished version would have one for ease of accessibility.
  -------------------------------
  P5 SANDBOX
  by George Kreye
  V1.0.0 - NOV 22, 2022
  
  CONTROLS:
  0-9: change material 
  Left click: place particle(s)
  Right click: remove particle(s)
  Mouse wheel: change brush size (experimental mode only)
  Escape: clear

  MATERIALS:
  1 - Stone
  2 - Sand (Water in experimental mode)
  3 - Wall (Sand in experimental mode)
  4 - None (Wall in experimental mode)
*/

// debug mode
const DEBUG = false;

// experimental features
const EXPERIMENTAL = false;

// constants
const BACKGROUND_COLOR = "#000000";
const HEAT_TRANSFER_AMOUNT = 1.0;
// have particle size divide canvas size evenly to avoid weird edge behavior
const PARTICLE_SIZE = 5;
const CANVAS_SIZE = 500;
const MIN_BRUSH_SIZE = 1;
const MAX_BRUSH_SIZE = PARTICLE_SIZE * 5;

// variables
let particles = [];
let materials = [];
let positions = [];
let currentMaterial = 0;
let brushSize = 1;

function setup() {
  // description for accessibility
  describe(
    "Sandbox simulation using square 'particles' placed by the user, displayed on a black-and-white grid. The simulation is interacted with using the mouse and number keys, and cleared using the escape key."
  );
  // create canvas
  let cnv = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  // cnv.parent("canvasContainer");

  // warn if canvas won't be evenly divided
  if (DEBUG) {
    console.assert(
      CANVAS_SIZE % PARTICLE_SIZE == 0,
      "Canvas of size " +
        CANVAS_SIZE +
        "cannot be evenly divided into particles of size " +
        PARTICLE_SIZE +
        ", may result in weird behavior at edges"
    );
  }

  // block rightclick shortcuts on canvas
  cnv.elt.addEventListener("contextmenu", (e) => e.preventDefault());

  // set framerate
  frameRate(60);
  rectMode(CENTER);

  // create particle grid
  for (let x = 0; x < width / PARTICLE_SIZE; x++) {
    // create empty y
    let c = [];
    let p = [];

    // fill y
    for (let y = 0; y < height / PARTICLE_SIZE; y++) {
      c.push(null);
      p.push(createVector(x * PARTICLE_SIZE, y * PARTICLE_SIZE));
    }

    // push to x
    particles.push(c);
    positions.push(p);
  }

  // populate materials list
  materials.push(new Stone());
  if (EXPERIMENTAL) {
    materials.push(new Water());
  }
  materials.push(new Sand());
  materials.push(new Wall());
}

function draw() {
  // clear
  background(BACKGROUND_COLOR);

  // grid BG
  drawGrid();

  // draw & update particles
  for (let x = 0; x < particles.length; x++) {
    if (particles[x].length > 0) {
      for (let y = 0; y < particles[x].length; y++) {
        if (particles[x][y] != null) {
          particles[x][y].display();
          particles[x][y].update();
        }
      }
    }
  }

  // cursor
  drawCursor();
  if (mouseIsPressed) {
    mouseBehavior();
  }
}

class Particle {
  constructor(position, index, material) {
    this.position = position.copy();
    this.index = index.copy();
    this.material = material;
  }

  // draws particle on canvas
  display() {
    push();

    // set fill & stroke
    fill(materials[this.material].color);
    noStroke();

    // set position
    translate(
      this.position.x + PARTICLE_SIZE / 2,
      this.position.y + PARTICLE_SIZE / 2
    );

    // draw
    rect(0, 0, PARTICLE_SIZE, PARTICLE_SIZE);
    pop();
  }

  // updates material
  update() {
    // perform material behavior
    materials[this.material].behavior(this);
  }

  // changes material
  changeMaterial(newMaterial) {
    this.material = newMaterial;
    if (DEBUG) {
      print("Changed material to material " + this.material);
    }
  }
}

/*abstract*/ class Material {
  constructor(color, isFluid) {
    this.color = color;
    this.isFluid = isFluid;
  }
}

// stone particle
class Stone extends Material {
  constructor() {
    super("#9E9E9E", false);
  }

  behavior(particle) {
    doGravity(particle);
  }
}

// function for handling gravity for solids
function doGravity(particle) {
  // get check bounds
  let bounds = checkBounds(particle);

  // don't do anything if at bottom or blocked by sufficient particles
  if (blockedOnBottom(particle, bounds)) {
    return;
  }

  // get non-blocked spaces
  let candidates = [];
  for (
    let x = particle.index.x + bounds[0];
    x <= particle.index.x + bounds[1];
    x++
  ) {
    let y = particle.index.y + bounds[3];

    // add to candidates if empty or occupied by a fluid
    if (particles[x][y] == null) {
      candidates.push(createVector(x, y));
    } else if (materials[particles[x][y].material].isFluid) {
      candidates.push(createVector(x, y));
    }
  }

  // failsafe
  if (candidates.length == 0) {
    return;
  }

  // determine space to move to randomly
  let newIndex;
  let newPosition;
  let r = Math.floor(random(candidates.length));
  newPosition = createVector(
    candidates[r].x * PARTICLE_SIZE,
    candidates[r].y * PARTICLE_SIZE
  );
  newIndex = candidates[r].copy();

  // move particle
  if (particles[newIndex.x][newIndex.y] == null) {
    particles[newIndex.x][newIndex.y] = new Particle(
      newPosition,
      newIndex,
      particle.material
    );
    delete particles[particle.index.x][particle.index.y];
  } else {
    displace(particle, newIndex);
  }
}

// Determines the valid bounds to use for checking the surroundings of a particle
function checkBounds(particle) {
  let xMin, xMax, yMin, yMax;

  // x bounds
  if (particle.position.x <= 0 || particle.index.x <= 0) {
    xMin = 0;
    xMax = 1;
  } else if (
    particle.position.x >= width - PARTICLE_SIZE / 4 ||
    particle.index.x >= width / PARTICLE_SIZE - PARTICLE_SIZE / 4
  ) {
    xMin = -1;
    xMax = 0;
  } else {
    xMin = -1;
    xMax = 1;
  }

  // y bounds
  if (particle.position.y <= 0 || particle.index.y <= 0) {
    yMin = 0;
    yMax = 1;
  } else if (
    particle.position.y >= height - PARTICLE_SIZE / 4 ||
    particle.index.y >= height / PARTICLE_SIZE - PARTICLE_SIZE / 4
  ) {
    yMin = -1;
    yMax = 0;
  } else {
    yMin = -1;
    yMax = 1;
  }

  // return bounds
  return [xMin, xMax, yMin, yMax];
}

// handles behavior on mouse press
function mouseBehavior() {
  // get x and y on grid
  let x = floor(mouseX) + PARTICLE_SIZE / 4;
  let y = floor(mouseY) + PARTICLE_SIZE / 4;

  // create particle(s) on left click
  if (mouseButton == LEFT) {
    for (
      let xO = x + 1 - brushSize * (PARTICLE_SIZE / 2);
      xO < x - 1 + brushSize * (PARTICLE_SIZE / 2);
      xO += 1
    ) {
      for (
        let yO = y + 1 - brushSize * (PARTICLE_SIZE / 2);
        yO < y - 1 + brushSize * (PARTICLE_SIZE / 2);
        yO += 1
      ) {
        placeParticle(xO, yO);
      }
    }
  }

  // erase particle(s) on right click
  if (mouseButton == RIGHT) {
    for (let xO = x - brushSize; xO <= x + brushSize; xO += 1) {
      for (let yO = y - brushSize; yO <= y + brushSize; yO += 1) {
        removeParticle(xO, yO);
      }
    }
  }
}

// Places particles based on brush size
function placeParticle(x, y) {
  // make sure x & y are valid
  if (x >= 0 && x < width && y >= 0 && y < height) {
    // snap to grid
    let indicies = snap(x, y);

    // make sure indicies are valid
    if (indicies == null) {
      return;
    } else if (
      indicies.x < 0 &&
      indicies.x >= particles.length &&
      indicies.y < 0 &&
      indicies.y >= particles[0].length
    ) {
      return;
    }

    // place particle if empty
    if (particles[indicies.x][indicies.y] == null) {
      particles[indicies.x][indicies.y] = new Particle(
        positions[indicies.x][indicies.y],
        createVector(indicies.x, indicies.y),
        currentMaterial
      );
    }
  }
}

// checks if a particle is blocked downwards
function blockedOnBottom(particle, bounds) {
  // check if at bottom of screen
  if (bounds[3] == 0) {
    return true;
  }

  // check if particles are filling bottom bound
  let blocked = true;
  for (
    let x = particle.index.x + bounds[0];
    x <= particle.index.x + bounds[1];
    x++
  ) {
    let y = particle.index.y + bounds[3];
    if (particles[x][y] == null || particles[x][y].isFluid) {
      // gap is present so not blocked
      blocked = false;
      break;
    }
  }

  // return result
  return blocked;
}

// debug grid
function drawGrid() {
  push();
  stroke(255);
  strokeWeight(0.1);
  for (let x = 0; x <= width; x += PARTICLE_SIZE) {
    line(x, 0, x, height);
  }
  for (let y = 0; y <= height; y += PARTICLE_SIZE) {
    line(0, y, width, y);
  }
  pop();
}

// draws cursor icon
function drawCursor() {
  noCursor();
  let x = floor(mouseX) + PARTICLE_SIZE / 2;
  let y = floor(mouseY);
  let temp = snap(x, y);
  // don't draw cursor if cursor is offscreen
  if (temp == null) {
    return;
  }
  let pos = positions[temp.x][temp.y];
  push();
  noFill();
  stroke(255);
  rect(
    pos.x + PARTICLE_SIZE / 2,
    pos.y + PARTICLE_SIZE / 2,
    PARTICLE_SIZE * brushSize
  );
  pop();
}

// snaps a position to grid
function snap(x, y) {
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions[i].length; j++) {
      // check if within bounds
      if (
        positions[i][j].x - PARTICLE_SIZE / 2 < x &&
        positions[i][j].x + PARTICLE_SIZE / 2 > x &&
        positions[i][j].y - PARTICLE_SIZE / 2 < y &&
        positions[i][j].y + PARTICLE_SIZE / 2 > y
      ) {
        // return indicies
        return createVector(i, j);
      }
    }
  }
}

// water particle
class Water extends Material {
  constructor() {
    super("#027FFC", true);
  }

  behavior(particle) {
    doLiquid(particle);
  }
}

// liquid behavior
function doLiquid(particle) {
  // get bounds
  let bounds = checkBounds(particle);

  // don't do anything if blocked by particles
  if (liquidBlocked(particle, bounds)) {
    return;
  }

  // determine candidates
  let candidates = [];
  for (
    let x = particle.index.x + bounds[0];
    x <= particle.index.x + bounds[1];
    x++
  ) {
    for (let y = particle.index.y; y <= particle.index.y + bounds[3]; y++) {
      if (
        (x != particle.index.x || y != particle.index.y) &&
        particles[x][y] == null
      ) {
        candidates.push(createVector(x, y));
      }
    }
  }

  // failsafe
  if (candidates.length == 0) {
    return;
  }

  // determine new position
  let newPosition;
  let newIndex;
  let straight = createVector(particle.index.x, particle.index.y + bounds[3]);
  // move straight down if possible
  if (includesVector(candidates, straight)) {
    newPosition = positions[straight.x][straight.y].copy();
    newIndex = straight.copy();
  } else {
    // determine new position randomly
    let r = Math.floor(random(candidates.length));
    newPosition = createVector(
      candidates[r].x * PARTICLE_SIZE,
      candidates[r].y * PARTICLE_SIZE
    );
    newIndex = candidates[r].copy();
  }

  // move particle
  particles[newIndex.x][newIndex.y] = new Particle(
    newPosition,
    newIndex,
    particle.material
  );
  delete particles[particle.index.x][particle.index.y];
}

// checks whether liquid movement is blocked
function liquidBlocked(particle, bounds) {
  // check if sides on same y are blocked
  let sidesBlocked;
  for (
    let x = particle.index.x + bounds[0];
    x <= particle.index.x + bounds[1];
    x++
  ) {
    // don't check current position
    if (x != particle.index.x) {
      let y = particle.index.y;
      // check if empty
      if (particles[x][y] == null) {
        sidesBlocked = false;
        break;
      }
    }
  }

  // return whether bottom is blocked as well as sides
  return blockedOnBottom(particle, bounds) && sidesBlocked;
}

// use mouse wheel to change brush size
function mouseWheel(event) {
  if (EXPERIMENTAL) {
    // get size change
    let diff = Math.sign(event.delta);

    // apply size change
    if (
      (brushSize > MIN_BRUSH_SIZE || diff == 1) &&
      (brushSize < MAX_BRUSH_SIZE || diff == -1)
    ) {
      brushSize += diff * PARTICLE_SIZE;
    }

    // prevent browser scrolling
    return false;
  }
}

// remove particles
function removeParticle(x, y) {
  // make sure x & y are valid
  if (x >= 0 && x < width && y >= 0 && y < height) {
    // snap to grid
    let indicies = snap(x, y);

    // make sure indicies are valid
    if (indicies == null) {
      return;
    } else if (
      indicies.x < 0 &&
      indicies.x >= particles.length &&
      indicies.y < 0 &&
      indicies.y >= particles[0].length
    ) {
      return;
    }

    // remove particle if not empty
    if (particles[indicies.x][indicies.y] != null) {
      delete particles[indicies.x][indicies.y];
    }
  }
}

// handle key press behavior
function keyPressed() {
  // check which key was pressed
  if (keyCode == ESCAPE) {
    // remove all particles in particle grid on escape press
    for (let x = 0; x < particles.length; x++) {
      for (let y = 0; y < particles[x].length; y++) {
        if (particles[x][y] != null) {
          delete particles[x][y];
        }
      }
    }
  } else if (keyCode >= 49 && keyCode <= 57) {
    // change material depending on number key pressed if possible
    if (keyCode - 49 < materials.length) {
      if (DEBUG) {
        print("Changed to material " + (keyCode - 49));
      }
      currentMaterial = keyCode - 49;
    }
  } else if (keyCode == 48) {
    // change material to material 9 if possible
    if (9 < materials.length) {
      if (DEBUG) {
        print("Changed to material 9");
      }
      currentMaterial = 9;
    }
  }
}

// checks if a given vector exists in an array
function includesVector(arr, vec) {
  for (let i = 0; i < arr.length; i++) {
    // check if vector matches input vector
    if (arr[i].equals(vec)) {
      return true; // match found
    }
  }
  return false; // match not found
}

// displace particles
function displace(particle, newIndex) {
  // get new position's old material
  let temp = particles[newIndex.x][newIndex.y].material;

  // set new materials
  particles[newIndex.x][newIndex.y].changeMaterial(particle.material);
  particles[particle.index.x][particle.index.y].changeMaterial(temp);
}

// sand material
class Sand extends Material {
  constructor() {
    super("#F7F2B7", false);
  }

  behavior(particle) {
    doGravity(particle);
  }
}

// wall material
class Wall extends Material {
  constructor() {
    super("#888888", false);
  }

  behavior(particle) {
    // solid wall, do nothing
  }
}
