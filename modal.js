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
#  Author:          Elise Badun, 2021
#
#  Contributors:
#
###############################################################################
*/

const backdrop = document.querySelector('.backdrop')
const modal = document.querySelector('.modal')
const button = document.querySelector('button.btn-close')

backdrop.addEventListener('click', closeModal)
button.addEventListener('click', closeModal)

function updateParagraph (errorMessage) {
  const outputParagraph = document.querySelector('#error-message')
  outputParagraph.textContent = errorMessage
}

function closeModal () {
  modal.style.display = 'none'
  backdrop.style.display = 'none'
}

function showModal (errorMessage) { // eslint-disable-line no-unused-vars
  updateParagraph(errorMessage)
  modal.style.display = 'block'
  backdrop.style.display = 'block'
}

// export { showModal }
