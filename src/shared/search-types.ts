export interface TextSearchMatch {
  lineNumber: number
  column: number
  lineText: string
  matchText: string
}

export interface FileSearchMatch extends TextSearchMatch {
  filePath: string
}

export interface FileSearchResult {
  matches: FileSearchMatch[]
  searchedFiles: number
  truncated: boolean
}

export interface FolderSearchRequest {
  query: string
  isRegex: boolean
  caseSensitive: boolean
  folderPath: string
  excludeFolders: string[]
  maxResults: number
}
