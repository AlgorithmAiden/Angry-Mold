const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")
import * as Color from './Colors.js'
    ;
(function resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    window.onresize = resize
})()
function isRunningOnPhone() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(userAgent)) {
        return true
    }
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return true
    }
    return false
}

const targetCellSize = isRunningOnPhone() ? 15 : 7

let gridWidth = Math.floor(canvas.width / targetCellSize)
let gridHeight = Math.floor(canvas.height / targetCellSize)

const cellSize = Math.round((canvas.width / gridWidth + canvas.height / gridHeight) / 2)

gridWidth = Math.floor(canvas.width / cellSize)
gridHeight = Math.floor(canvas.height / cellSize)

const offsetWidth = Math.round((canvas.width - gridWidth * cellSize) / 2)
const offsetHeight = Math.round((canvas.height - gridHeight * cellSize) / 2)

let grid = new Array(gridWidth).fill(0).map(() => new Array(gridHeight).fill(0).map(() => ({ type: 'empty' })))

let updateList = []

for (let x = 0; x < gridWidth; x++) for (let y = 0; y < gridHeight; y++) updateList.push({ x, y })

let usedHues = []

function getHue() {

    //edge case where there are no usedHues yet
    if (usedHues.length == 0) {
        const out = Math.random() * 360
        usedHues.push(out)
        return (out)
    }

    // Sort the array to arrange points in ascending order
    const sortedArr = usedHues.slice().sort((a, b) => a - b)

    // Add the first element to the end plus the range size (360 degrees) for circular calculation
    sortedArr.push(sortedArr[0] + 360)

    // Calculate gaps between consecutive elements, considering circularity
    let gaps = []
    for (let i = 0; i < sortedArr.length - 1; i++) {
        const gap = sortedArr[i + 1] - sortedArr[i]
        gaps.push({ start: sortedArr[i], size: gap })
    }

    // Find the maximum gap size
    const maxGapSize = Math.max(...gaps.map(gap => gap.size))

    // Filter gaps to find all that match the maximum size
    const maxGaps = gaps.filter(gap => gap.size === maxGapSize)

    // Randomly select one of the largest gaps if there are multiple
    const selectedGap = maxGaps[Math.floor(Math.random() * maxGaps.length)]

    // The furthest point is in the middle of the selected largest gap
    let furthestPoint = (selectedGap.start + selectedGap.size / 2) % 360

    usedHues.push(furthestPoint)

    return furthestPoint
}

function cellAt(x, y) {
    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return false
    return grid[x][y]
}

function cellUpdate(pos) {
    let self = grid[pos.x][pos.y]

    //age
    self.age += Math.random()
    if (self.invincibility > 0) self.invincibility--
    // console.log(self.invincibility)

    //die
    const root = self.root
    if (root != 'self' && grid[pos.x + root.dir.x][pos.y + root.dir.y].id != root.id) {
        grid[pos.x][pos.y] = { type: 'empty' }
        updateList.push(pos)
        return
    }

    //die randomly too
    if (Math.random() < .00001) {

        //make sure to remove colors from the used hues
        if (self.root == 'self') usedHues.filter(i => i != self.color.hue)

        grid[pos.x][pos.y] = { type: 'empty' }
        updateList.push(pos)
        return
    }

    //calculate distance
    if (self.root == 'self') self.distance = 1
    else self.distance = grid[pos.x + self.root.dir.x][pos.y + self.root.dir.y].distance + 1

    //grow
    let dirs = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }].sort(() => Math.random() * 2 - 1)
    for (let dir of dirs) {
        let touchingSelf = 0
        let touchingEnemy = 0
        for (const subDir of dirs) {
            const targetCell = cellAt(pos.x + dir.x + subDir.x, pos.y + dir.y + subDir.y)
            if (targetCell.type == 'cell')
                if (targetCell.endRoot == self.endRoot)
                    touchingSelf++
                else
                    touchingEnemy++
        }
        dir.touchingSelf = touchingSelf
        dir.touchingEnemy = touchingEnemy
    }
    if (self.age < 50)
        dirs = dirs.filter(i => i.touchingSelf == 1)
    for (const dir of dirs) {
        const targetCell = cellAt(pos.x + dir.x, pos.y + dir.y)
        if (
            targetCell.type == 'empty' ||
            (targetCell.type == 'cell' &&
                (!targetCell.invincibility > 0) &&
                targetCell.endRoot != self.endRoot &&
                Math.cos((Date.now() / (self.endRoot * 9999 % 500)) + self.endRoot * 9999) < Math.random() - 1 + (self.invincibility / 100))) {

            //make sure to remove colors from the used hues
            if (targetCell.root == 'self') usedHues.filter(i => i != targetCell.color.hue)


            //slight chance to mutate into a new node
            if (Math.random() < .0001)
                grid[pos.x + dir.x][pos.y + dir.y] = {
                    type: 'cell',
                    root: 'self',
                    endRoot: nextCellId,
                    id: nextCellId,
                    age: 0,
                    distance: 1,
                    invincibility: 100,
                    color: Color.createColor([['saturation', 100], ['lightness', 50], ['hue', getHue()]])
                }
            else
                grid[pos.x + dir.x][pos.y + dir.y] = {
                    id: nextCellId,
                    type: 'cell',
                    root: {
                        dir: {
                            x: -dir.x,
                            y: -dir.y
                        },
                        id: self.id
                    },
                    endRoot: self.endRoot,
                    color: self.color,
                    age: 0,
                    invincibility: 0,
                    distance: 0
                }
            nextCellId++
            updateList.push(pos)
            updateList.push({ x: pos.x + dir.x, y: pos.y + dir.y })
            break
        }
    }
}

let nextCellId = 1

ctx.fillStyle = '#000'
ctx.fillRect(0, 0, canvas.width, canvas.height)

function update() {

    //render
    for (const pos of updateList) {
        const x = pos.x
        const y = pos.y
        let cell = grid[x][y]
        if (cell.type == 'empty')
            ctx.fillStyle = '#151515'
        else if (cell.type == 'cell') {
            if (cell.root == 'self')
                ctx.fillStyle = '#fff'
            else {
                const color = cell.color
                const mult = 1 / (cell.distance / 50)
                ctx.fillStyle = `rgb(${color.red * mult
                    },${color.green * mult
                    },${color.blue * mult
                    })`
            }
        }
        else
            ctx.fillStyle = foodColor(cell)
        ctx.fillRect(offsetWidth + x * cellSize, offsetHeight + y * cellSize, cellSize, cellSize)
    }
    updateList = []

    //get all pos
    let allPos = []
    for (let x = 0; x < gridWidth; x++)
        for (let y = 0; y < gridHeight; y++)
            if (grid[x][y].type == 'cell')
                allPos.push({ x, y })

    //randomize the order of updates
    allPos.sort(() => Math.random() * 2 - 1)

    //run the updates
    for (let pos of allPos) {
        cellUpdate(pos)
    }
}

let running = true
let oneTick = true
document.addEventListener('keypress', e => {
    if (e.key == ' ') {
        if (e.shiftKey) {
            grid = new Array(gridWidth).fill(0).map(() => new Array(gridHeight).fill(0).map(() => {
                if (Math.random() < .001) {
                    usedHues = []
                    nextCellId++
                    return {
                        type: 'cell',
                        root: 'self',
                        endRoot: nextCellId - 1,
                        id: nextCellId - 1,
                        age: 0,
                        distance: 1,
                        invincibility: 100,
                        color: Color.createColor([['saturation', 100], ['lightness', 50], ['hue', getHue()]])
                    }
                } else return { type: 'empty' }
            }))
            for (let x = 0; x < gridWidth; x++) for (let y = 0; y < gridHeight; y++) updateList.push({ x, y })
        } else {
            running = !running
            console.log('running:', running)
        }
    }
    if (e.key == '`') {
        oneTick = true
        console.log('oneTick')
    }
})

setInterval(() => {
    if (running || oneTick) {
        oneTick = false
        update()
    }
}, 1000 / 30)

document.addEventListener('click', e => {
    let x = Math.floor((e.offsetX - offsetWidth) / cellSize)
    let y = Math.floor((e.offsetY - offsetHeight) / cellSize)
    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return
    if (e.shiftKey) {
        grid[x][y] = {
            type: 'cell',
            root: 'self',
            endRoot: nextCellId,
            id: nextCellId,
            age: 0,
            distance: 1,
            invincibility: 100,
            color: Color.createColor([['saturation', 100], ['lightness', 50], ['hue', getHue()]])
        }
        nextCellId++
    }
    else
        grid[x][y] = { type: 'empty' }
})

grid[Math.floor(Math.random() * gridWidth)][Math.floor(Math.random() * gridHeight)] = {
    type: 'cell',
    root: 'self',
    endRoot: nextCellId,
    id: nextCellId,
    age: 0,
    distance: 1,
    invincibility: 100,
    color: Color.createColor([['saturation', 100], ['lightness', 50], ['hue', getHue()]])
}
nextCellId++

//cell types:
//cell (plant)
//empty

//each cell has its own id to make roots work well

// [*] step 1: make plants that grow, and die when their root does
// [*] step 2: make plants grow smarter to maximize spread
// [*] step 3: add really cool plant colors, and make each new plant choose an optimal color
// [*] step 4: make plants of different roots eat eachother, giving each its own rhythm
// [*] step 5: make cells sometimes die of age, and sometimes mutate into new nodes