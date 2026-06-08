/*
###############################################################################
#
#  EGSnrc online voxel and dose visualization tool
#  Copyright (C) 2020 Magdalena Bazalova-Carter and Elise Badun
#
#  This file is part of EGSnrc.
#
#  EGSnrc is free software: you can redistribute it and/or modify it under
#  the terms of the GNU Affero General Public License as published by the
#  Free Software Foundation, either version 3 of the License, or (at your
#  option) any later version.
#
#  EGSnrc is distributed in the hope that it will be useful, but WITHOUT ANY
#  WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
#  FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for
#  more details.
#
#  You should have received a copy of the GNU Affero General Public License
#  along with EGSnrc. If not, see <http://www.gnu.org/licenses/>.
#
###############################################################################
#
#  Author:          Elise Badun, 2020
#
#  Contributors:
#
###############################################################################
*/

// definitions for StandardJS formatter
/* global d3 */
/* global File */
/* global FileReader */

const SPACE_REGEX = /\s+/
const TEXT_DECODER = new TextDecoder('utf-8')
const LATIN1_DECODER = new TextDecoder('iso-8859-1')
const STREAMING_DOSE_THRESHOLD_BYTES = 64 * 1024 * 1024 // eslint-disable-line no-unused-vars
const STREAMING_PHANTOM_THRESHOLD_BYTES = 64 * 1024 * 1024 // eslint-disable-line no-unused-vars
const FILE_READ_CHUNK_BYTES = 16 * 1024 * 1024

/**
 * @param {number} code
 * @returns {boolean}
 */
function isWhitespaceCharCode (code) {
  return code === 32 || code === 9 || code === 10 || code === 13
}

/**
 * Read a byte range from a File as an ArrayBuffer.
 *
 * @param {File} file
 * @param {number} start
 * @param {number} end
 * @returns {Promise<ArrayBuffer>}
 */
function readFileSlice (file, start, end) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Failed to read file slice'))
    reader.readAsArrayBuffer(file.slice(start, end))
  })
}

/**
 * Incrementally read ASCII lines from a file without loading it entirely.
 *
 * @param {File} file
 */
function createAsciiFileReader (file) {
  let offset = 0
  let partial = ''

  async function fillBuffer () {
    if (offset >= file.size) {
      return false
    }
    const end = Math.min(offset + FILE_READ_CHUNK_BYTES, file.size)
    const buffer = await readFileSlice(file, offset, end)
    partial += LATIN1_DECODER.decode(buffer)
    offset = end
    return true
  }

  return {
    /**
     * @returns {Promise<string|null>}
     */
    async readLine () {
      while (true) {
        const match = partial.match(/^([^\r\n]*)(\r?\n)/)
        if (match) {
          const line = match[1]
          partial = partial.slice(match[0].length)
          return line
        }
        if (offset >= file.size) {
          if (partial.length === 0) {
            return null
          }
          const line = partial
          partial = ''
          return line
        }
        await fillBuffer()
      }
    },

    /**
     * Byte offset where unparsed content in the partial buffer begins.
     *
     * @returns {number}
     */
    getContentStartOffset () {
      return offset - partial.length
    }
  }
}

/**
 * @param {Function} readLine
 * @param {number} numVox
 * @returns {Promise<number[]>}
 */
async function readBoundaryArray (readLine, numVox) {
  const arr = []
  while (arr.length <= numVox) {
    const line = await readLine()
    if (line === null) {
      throw new Error('Unexpected end of file while reading voxel boundaries')
    }
    const parts = line.trim().split(SPACE_REGEX).filter(Boolean)
    for (const part of parts) {
      arr.push(parseFloat(part))
    }
  }
  return arr
}

/**
 * @param {number} numVoxX
 * @param {number} numVoxY
 * @param {number} numVoxZ
 * @param {number[]} xArr
 * @param {number[]} yArr
 * @param {number[]} zArr
 * @param {Array<number>} dose
 * @param {Array<number>} error
 * @param {number} maxDose
 * @returns {Object}
 */
function buildDoseVolumeResult (numVoxX, numVoxY, numVoxZ, xArr, yArr, zArr, dose, error, maxDose) {
  return {
    voxelNumber: {
      x: numVoxX, // The number of x voxels
      y: numVoxY, // The number of y voxels
      z: numVoxZ // The number of z voxels
    },
    voxelArr: {
      x: xArr, // The dimensions of x voxels
      y: yArr, // The dimensions of x voxels
      z: zArr // The dimensions of x voxels
    },
    voxelSize: {
      x: xArr[1] - xArr[0],
      y: yArr[1] - yArr[0],
      z: zArr[1] - zArr[0]
    },
    dose: dose, // The flattened dose matrix
    error: error, // The flattened error matrix
    maxDose: maxDose, // The maximum dose value
    units: 'RELATIVE' // The dose units
  }
}

/**
 * Populate a sparse dose array and track the maximum dose value.
 *
 * @param {number[]} values
 * @param {number} numVoxels
 * @returns {{ dose: Array<number>, maxDose: number }}
 */
function buildSparseDoseArray (values, numVoxels) {
  let maxDose = 0
  const dose = new Array(numVoxels)
  const count = Math.min(values.length, numVoxels)

  for (let i = 0; i < count; i++) {
    const elem = values[i]
    if (elem !== 0) {
      dose[i] = elem
      if (elem > maxDose) {
        maxDose = elem
      }
    }
  }

  return { dose, maxDose }
}

/**
 * Stream-parse dose and error floats from the remainder of a .3ddose file.
 *
 * @param {File} file
 * @param {number} startOffset
 * @param {number} numVoxels
 * @param {Function} [onProgress] Called as (bytesRead, totalBytes).
 * @returns {Promise<{ dose: Array<number>, error: Array<number>, maxDose: number }>}
 */
async function parseDoseAndErrorFromFile (file, startOffset, numVoxels, onProgress) {
  const dose = new Array(numVoxels)
  const error = new Array(numVoxels)
  let maxDose = 0
  let phase = 0
  let index = 0
  let doseCount = 0
  let errorCount = 0
  let partial = ''
  let offset = startOffset

  const storeValue = (value) => {
    if (phase === 0) {
      doseCount++
      if (value !== 0) {
        dose[index] = value
        if (value > maxDose) {
          maxDose = value
        }
      }
    } else {
      errorCount++
      if (value !== 0) {
        error[index] = value
      }
    }

    index++
    if (phase === 0 && index >= numVoxels) {
      phase = 1
      index = 0
    }
  }

  while (offset < file.size && !(phase === 1 && index >= numVoxels)) {
    const chunkEnd = Math.min(offset + FILE_READ_CHUNK_BYTES, file.size)
    const buffer = await readFileSlice(file, offset, chunkEnd)
    partial += LATIN1_DECODER.decode(buffer)
    offset = chunkEnd

    let tokenStart = -1
    for (let i = 0; i < partial.length; i++) {
      const isWs = isWhitespaceCharCode(partial.charCodeAt(i))
      if (!isWs && tokenStart === -1) {
        tokenStart = i
      }
      if (isWs && tokenStart !== -1) {
        storeValue(parseFloat(partial.slice(tokenStart, i)))
        tokenStart = -1
        if (phase === 1 && index >= numVoxels) {
          partial = ''
          break
        }
      }
    }

    if (tokenStart !== -1) {
      partial = partial.slice(tokenStart)
    } else {
      partial = ''
    }

    if (onProgress) {
      onProgress(offset, file.size)
    }
  }

  if (partial.length > 0) {
    storeValue(parseFloat(partial))
  }

  if (doseCount < numVoxels) {
    throw new Error(`Unexpected end of file: expected ${numVoxels} dose values, found ${doseCount}`)
  }

  if (errorCount < numVoxels) {
    console.warn(`Incomplete .3ddose error block: expected ${numVoxels} values, found ${errorCount}. Filling missing values with 0.`)
    for (let i = errorCount; i < numVoxels; i++) {
      error[i] = 0
    }
  }

  return { dose, error, maxDose }
}

/**
 * Extract data from a large .3ddose file using chunked reads.
 *
 * @param {File} file
 * @param {Function} [onProgress] Called as (bytesRead, totalBytes).
 * @returns {Promise<Object>}
 */
const processDoseDataFromFile = async function (file, onProgress) { // eslint-disable-line no-unused-vars
  const reader = createAsciiFileReader(file)

  const firstLine = await reader.readLine()
  if (firstLine === null) {
    throw new Error('Unexpected end of file while reading voxel counts')
  }

  const [numVoxX, numVoxY, numVoxZ] = firstLine
    .trim()
    .split(SPACE_REGEX)
    .map((v) => parseInt(v))

  const xArr = await readBoundaryArray(reader.readLine.bind(reader), numVoxX)
  const yArr = await readBoundaryArray(reader.readLine.bind(reader), numVoxY)
  const zArr = await readBoundaryArray(reader.readLine.bind(reader), numVoxZ)

  const numVoxels = numVoxX * numVoxY * numVoxZ
  const { dose, error, maxDose } = await parseDoseAndErrorFromFile(
    file,
    reader.getContentStartOffset(),
    numVoxels,
    onProgress
  )

  return buildDoseVolumeResult(numVoxX, numVoxY, numVoxZ, xArr, yArr, zArr, dose, error, maxDose)
}

/**
 * @param {string[]} materialList
 * @returns {Object}
 */
function buildMaterialDict (materialList) {
  const materialDict = { 0: 'VACUUM' }
  const toSymbol = (i) => String.fromCharCode(((i + 16) % 95) + 32)
  materialList.forEach((materialName, i) => {
    materialDict[toSymbol(i + 1)] = materialName
  })
  return materialDict
}

/**
 * @param {number} numVoxX
 * @param {number} numVoxY
 * @param {number} numVoxZ
 * @param {number[]} xArr
 * @param {number[]} yArr
 * @param {number[]} zArr
 * @param {Array<number>} density
 * @param {string[]} material
 * @param {Object} materialDict
 * @param {number} minDensity
 * @param {number} maxDensity
 * @returns {Object}
 */
function buildPhantomVolumeResult (
  numVoxX, numVoxY, numVoxZ, xArr, yArr, zArr,
  density, material, materialDict, minDensity, maxDensity
) {
  return {
    voxelNumber: {
      x: numVoxX,
      y: numVoxY,
      z: numVoxZ
    },
    voxelArr: {
      x: xArr,
      y: yArr,
      z: zArr
    },
    voxelSize: {
      x: xArr[1] - xArr[0],
      y: yArr[1] - yArr[0],
      z: zArr[1] - zArr[0]
    },
    density: density,
    materialDict: materialDict,
    material: material,
    minDensity: minDensity,
    maxDensity: maxDensity
  }
}

/**
 * @param {Function} readLine
 * @param {number} numMaterials
 */
async function skipMaterialDensityLines (readLine, numMaterials) {
  const line = await readLine()
  if (line === null) {
    throw new Error('Unexpected end of file while reading material densities')
  }
  const parts = line.trim().split(SPACE_REGEX).filter(Boolean)
  if (parts.length !== numMaterials) {
    for (let i = 1; i < numMaterials; i++) {
      const extra = await readLine()
      if (extra === null) {
        throw new Error('Unexpected end of file while reading material densities')
      }
    }
  }
}

/**
 * @param {Function} readLine
 * @param {number} numLines
 * @param {string} [firstLine]
 * @returns {Promise<string[]>}
 */
async function readFixedSectionLines (readLine, numLines, firstLine) {
  const lines = []
  let consumed = 0

  if (firstLine !== undefined) {
    const trimmed = firstLine.trim()
    if (trimmed.length > 0) {
      lines.push(trimmed)
    }
    consumed = 1
  }

  for (let i = consumed; i < numLines; i++) {
    const line = await readLine()
    if (line === null) {
      throw new Error('Unexpected end of file while reading phantom data')
    }
    const trimmed = line.trim()
    if (trimmed.length > 0) {
      lines.push(trimmed)
    }
  }

  return lines
}

/**
 * @param {Function} readLine
 * @param {number} numLines
 * @param {number} numVoxX
 * @param {number} numVoxels
 * @param {Function} [reportProgress]
 * @returns {Promise<{ density: Array<number>, minDensity: number, maxDensity: number }>}
 */
async function parsePhantomDensityLines (readLine, numLines, numVoxX, numVoxels, reportProgress) {
  const density = new Array(numVoxels)
  let minDensity = Infinity
  let maxDensity = -Infinity
  let rowIndex = 0

  for (let i = 0; i < numLines; i++) {
    const line = await readLine()
    if (line === null) {
      throw new Error('Unexpected end of file while reading density data')
    }

    const trimmed = line.trim()
    if (trimmed.length > 0) {
      const parts = trimmed.split(SPACE_REGEX).filter(Boolean)
      const rowStart = rowIndex * numVoxX

      for (let j = 0; j < parts.length && j < numVoxX; j++) {
        const val = parseFloat(parts[j])
        const idx = rowStart + j
        if (idx < numVoxels) {
          density[idx] = val
          if (val < minDensity) {
            minDensity = val
          }
          if (val > maxDensity) {
            maxDensity = val
          }
        }
      }
      rowIndex++
    }

    if (reportProgress) {
      reportProgress()
    }
  }

  return {
    density: density.slice(0, numVoxels),
    minDensity: minDensity === Infinity ? 0 : minDensity,
    maxDensity: maxDensity === -Infinity ? 0 : maxDensity
  }
}

/**
 * Extract data from a large .egsphant file using chunked reads.
 *
 * @param {File} file
 * @param {Function} [onProgress] Called as (bytesRead, totalBytes).
 * @returns {Promise<Object>}
 */
const processPhantomDataFromFile = async function (file, onProgress) { // eslint-disable-line no-unused-vars
  const reader = createAsciiFileReader(file)
  const readLine = reader.readLine.bind(reader)

  const reportProgress = () => {
    if (onProgress) {
      onProgress(reader.getContentStartOffset(), file.size)
    }
  }

  let line = await readLine()
  if (line === null) {
    throw new Error('Unexpected end of file while reading material count')
  }

  const numMaterials = parseInt(line.trim())
  const materialList = []

  for (let i = 0; i < numMaterials; i++) {
    line = await readLine()
    if (line === null) {
      throw new Error('Unexpected end of file while reading material names')
    }
    materialList.push(line.trim())
  }

  const materialDict = buildMaterialDict(materialList)
  await skipMaterialDensityLines(readLine, numMaterials)
  reportProgress()

  line = await readLine()
  if (line === null) {
    throw new Error('Unexpected end of file while reading voxel counts')
  }

  const [numVoxX, numVoxY, numVoxZ] = line
    .trim()
    .split(SPACE_REGEX)
    .filter(Boolean)
    .map((v) => parseInt(v))

  const xArr = await readBoundaryArray(readLine, numVoxX)
  const yArr = await readBoundaryArray(readLine, numVoxY)
  const zArr = await readBoundaryArray(readLine, numVoxZ)
  reportProgress()

  line = await readLine()
  if (line === null) {
    throw new Error('Unexpected end of file while reading material grid')
  }

  const firstMaterialLine = line.trim().length === 0 ? undefined : line
  const numSectionLines = numVoxY * numVoxZ + numVoxZ
  const material = await readFixedSectionLines(readLine, numSectionLines, firstMaterialLine)
  reportProgress()

  const numVoxels = numVoxX * numVoxY * numVoxZ
  const { density, minDensity, maxDensity } = await parsePhantomDensityLines(
    readLine,
    numSectionLines,
    numVoxX,
    numVoxels,
    reportProgress
  )

  return buildPhantomVolumeResult(
    numVoxX, numVoxY, numVoxZ, xArr, yArr, zArr,
    density, material, materialDict, minDensity, maxDensity
  )
}

/**
 * Decode an ArrayBuffer as UTF-8 text.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {string}
 */
const arrayBufferToText = function (arrayBuffer) { // eslint-disable-line no-unused-vars
  return TEXT_DECODER.decode(arrayBuffer)
}

/**
 * Decode an ArrayBuffer and split into lines.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {string[]}
 */
const arrayBufferToLines = function (arrayBuffer) { // eslint-disable-line no-unused-vars
  return arrayBufferToText(arrayBuffer).split(/\r?\n/)
}

/**
 * Extract data from .egsphant files.
 *
 * @param {string[]} data The .egsphant file as one string per line.
 * @returns {Object}
 */
const processPhantomData = function (data) { // eslint-disable-line no-unused-vars
  const getMax = function (a) {
    return Math.max(...a.map((e) => (Array.isArray(e) ? getMax(e) : e)))
  }

  const getMin = function (a) {
    return Math.min(...a.map((e) => (Array.isArray(e) ? getMin(e) : e)))
  }

  // The current line of the text file being read
  let curr = 0

  // Get number and type of materials
  const numMaterials = parseInt(data[curr++])
  const materialList = data.slice(curr, numMaterials + curr).map(mat => mat.trim())
  const materialDict = buildMaterialDict(materialList)

  curr += numMaterials
  curr += (data[curr].trim().split(SPACE_REGEX).length === numMaterials) ? 1 : numMaterials

  // Get number of x, y, and z voxels
  const [numVoxX, numVoxY, numVoxZ] = data[curr++]
    .trim()
    .split(SPACE_REGEX)
    .map((v) => {
      return parseInt(v)
    })

  // Get x, y, and z arrays
  const [xArr, yArr, zArr] = data.slice(curr, curr + 3).map((subArr) => { // eslint-disable-line no-global-assign
    return subArr
      .trim()
      .split(SPACE_REGEX)
      .map((v) => {
        return parseFloat(v)
      })
  })

  curr += 3

  // Some files have a space here, others do not, so skip line if it is empty
  if (data[curr].trim().length === 0) {
    curr++
  }

  // Read the material data
  const material = data
    .slice(
      curr,
      parseInt(curr) + parseInt(numVoxY) * parseInt(numVoxZ) + parseInt(numVoxZ) - 1
    )
    .map((subArr) => subArr.trim())
    .filter((subArr) => subArr.length > 0)

  curr += numVoxY * numVoxZ + numVoxZ

  // Read the density data
  const lines = data
    .slice(
      curr,
      parseInt(curr) + parseInt(numVoxY) * parseInt(numVoxZ) + parseInt(numVoxZ) - 1
    )
    .map((subArr) => subArr.trim())
    .filter((subArr) => subArr.length > 0)

  const densityGrid = lines.map((subArr) => {
    return subArr
      .trim()
      .split(SPACE_REGEX)
      .map((v) => {
        return parseFloat(v)
      })
  })

  const minDensity = getMin(densityGrid)
  const maxDensity = getMax(densityGrid)

  // TODO: .flat() does not work in Safari, find an alternative
  const density = densityGrid.flat().slice(0, numVoxX * numVoxY * numVoxZ)

  return buildPhantomVolumeResult(
    numVoxX, numVoxY, numVoxZ, xArr, yArr, zArr,
    density, material, materialDict, minDensity, maxDensity
  )
}

/**
 * Extract data from .3ddose files.
 *
 * @param {string[]} data The .3ddose file as one string per line.
 * @returns {Object}
 */
const processDoseData = function (data) { // eslint-disable-line no-unused-vars
  // The current line of the text file being read
  let curr = 0

  // Get number of x, y, and z voxels
  const [numVoxX, numVoxY, numVoxZ] = data[curr++]
    .trim()
    .split(SPACE_REGEX)
    .map((v) => parseInt(v))

  // Get x, y, and z arrays
  const [xArr, yArr, zArr] = [numVoxX, numVoxY, numVoxZ].map((numVox) => {
    const arr = []
    while (arr.length <= numVox) {
      arr.push(
        ...data[curr++]
          .trim()
          .split(SPACE_REGEX)
          .map((v) => parseFloat(v))
      )
    }
    return arr
  })

  // Get the dose and error arrays
  const numVoxels = numVoxX * numVoxY * numVoxZ
  let [doseDense, error] = [[], []]
  const prevCurr = curr

  try {
    // This method works if there are line breaks throughout the data
    [doseDense, error].forEach((arr) => {
      while (arr.length < numVoxels) {
        arr.push(
          ...data[curr++]
            .trim()
            .split(SPACE_REGEX)
            .map((v) => parseFloat(v))
        )
      }
    })
  } catch (e) {
    if (e instanceof RangeError) {
      // If range error, the length of each line is too long for the spread syntax, now assuming all data is in one line
      [doseDense, error] = data.slice(prevCurr, prevCurr + 2).map((arr) => {
        return arr
          .trim()
          .split(SPACE_REGEX)
          .slice(0, numVoxels)
          .map((v) => parseFloat(v))
      })
    } else {
      throw e
    }
  }

  const { dose, maxDose } = buildSparseDoseArray(doseDense, numVoxels)

  return buildDoseVolumeResult(numVoxX, numVoxY, numVoxZ, xArr, yArr, zArr, dose, error, maxDose)
}

/**
 * Extract data from .csv files.
 *
 * @param {Object} data The .csv file read as text.
 * @returns {Object}
 */
const processCsvData = function (data) { // eslint-disable-line no-unused-vars
  // The current line of the text file being read

  const DIMS = ['x', 'y', 'z']
  const dataSplit = data.trim('').split(/\r?\n/g)

  let curr = 0
  const groupList = []

  while (dataSplit[curr][0] === '#') {
    const regex = /^#\s*(?<dimension>X|Y|Z)\D*\s*(?<bins>\d+)\s*(bin|bins)\D*\s*(?<voxSize>\d+(\.\d*)?)/i
    const found = dataSplit[curr++].match(regex)
    if (found && found.groups) {
      groupList.push(found.groups)
    }
  }

  const groupObj = groupList.reduce(function (acc, obj) { acc[obj.dimension.toLowerCase()] = { bins: obj.bins, voxSize: obj.voxSize }; return acc }, {})

  // Get number of x, y, and z voxels
  const [numVoxX, numVoxY, numVoxZ] = DIMS.map((dim) => parseInt(groupObj[dim].bins))

  // Get x, y, and z arrays
  const [xArr, yArr, zArr] = DIMS.map((dim) => {
    const numVox = groupObj[dim].bins
    const voxSize = groupObj[dim].voxSize
    return d3.range(-voxSize * numVox / 2, voxSize * (numVox / 2 + 1), voxSize)
  })

  // Get the dose and error arrays
  const dose = new Array(numVoxX * numVoxY * numVoxZ)
  const error = new Array(numVoxX * numVoxY * numVoxZ)
  let address, idx

  const parsedData = dataSplit.slice(curr).map((line) => parseFloat(line.split(',')[3].trim()))

  for (let x = 0; x < numVoxX; x++) {
    for (let y = 0; y < numVoxY; y++) {
      for (let z = 0; z < numVoxZ; z++) {
        // First index changing fastest, last index changing slowest
        idx = x + (y * numVoxX) + (z * numVoxX * numVoxY)
        address = z + (y * numVoxZ) + (x * numVoxY * numVoxZ)
        dose[idx] = parsedData[address]
      }
    }
  }

  // Calculate maximum dose
  let maxDose = 0
  dose.forEach((elem, i) => {
    if (dose[i] > maxDose) {
      maxDose = dose[i]
    }
  })

  return {
    voxelNumber: {
      x: numVoxX, // The number of x voxels
      y: numVoxY, // The number of y voxels
      z: numVoxZ // The number of z voxels
    },
    voxelArr: {
      x: xArr, // The dimensions of x voxels
      y: yArr, // The dimensions of x voxels
      z: zArr // The dimensions of x voxels
    },
    voxelSize: {
      x: xArr[1] - xArr[0],
      y: yArr[1] - yArr[0],
      z: zArr[1] - zArr[0]
    },
    dose: dose, // The flattened dose matrix
    error: error, // The flattened error matrix
    maxDose: maxDose, // The maximum dose value
    units: 'RELATIVE' // The dose units
  }
}

// export { arrayBufferToText, arrayBufferToLines, processDoseData, processDoseDataFromFile, processPhantomData, processPhantomDataFromFile, processCsvData, STREAMING_DOSE_THRESHOLD_BYTES, STREAMING_PHANTOM_THRESHOLD_BYTES }
