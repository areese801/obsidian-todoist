export interface ParsedTask {
	markdownPart: string;
	task: string;
	taskMd5Hash: string;
	originalString: string;
	lineNumber: number;
}

export interface TodoistTask {
	id: string;
	content: string;
	description: string;
	url: string;
}

export interface MigrationResult {
	created: number;
	skippedDuplicate: number;
	skippedFrontmatter: number;
	errors: string[];
}
