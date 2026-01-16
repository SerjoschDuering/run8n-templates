export interface UiSlice {
  isModalOpen: boolean
  modalContent: string | null
  openModal: (content: string) => void
  closeModal: () => void
}

export const uiSlice = (set: any, get: any): UiSlice => ({
  isModalOpen: false,
  modalContent: null,

  openModal: (content: string) => {
    set({ isModalOpen: true, modalContent: content })
  },

  closeModal: () => {
    set({ isModalOpen: false, modalContent: null })
  },
})
