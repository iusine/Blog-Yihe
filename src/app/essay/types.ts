export type NoteStyle = 'sunny' | 'mint' | 'sky' | 'lavender' | 'paper'

export const NOTE_STYLES: NoteStyle[] = ['sunny', 'mint', 'sky', 'lavender', 'paper']

export type EssayNote = {
	id: string
	title: string
	content: string
	style: NoteStyle
	createdAt: string
	stars: number
}
