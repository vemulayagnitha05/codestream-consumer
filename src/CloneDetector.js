const emptyLine = /^\s*$/;
const oneLineComment = /\/\/.*/;
const oneLineMultiLineComment = /\/\*.*?\*\//;
const openMultiLineComment = /\/\*+[^\*\/]*$/;
const closeMultiLineComment = /^[\*\/]*\*+\//;

const SourceLine = require('./SourceLine');
const FileStorage = require('./FileStorage');
const Clone = require('./Clone');
const crypto = require('crypto');
const DEFAULT_CHUNKSIZE=5;

class CloneDetector {
    #myChunkSize = Number(process.env.CHUNKSIZE || DEFAULT_CHUNKSIZE);
    #myFileStore = FileStorage.getInstance();

    constructor() {
    }

    // Private Methods
    // --------------------
    #filterLines(file) {
        let lines = file.contents.split('\n');
        let inMultiLineComment = false;
        file.lines=[];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            if ( inMultiLineComment ) {
                if ( -1 != line.search(closeMultiLineComment) ) {
                    line = line.replace(closeMultiLineComment, '');
                    inMultiLineComment = false;
                } else {
                    line = '';
                }
            }

            line = line.replace(emptyLine, '');
            line = line.replace(oneLineComment, '');
            line = line.replace(oneLineMultiLineComment, '');

            if ( -1 != line.search(openMultiLineComment) ) {
                line = line.replace(openMultiLineComment, '');
                inMultiLineComment = true;
            }

            file.lines.push( new SourceLine(i+1, line.trim()) );
        }

        return file;
    }

    #getContentLines(file) {
        return file.lines.filter( line => line.hasContent() );
    }
    #chunkify(file) {
        let chunkSize = this.#myChunkSize;
        let lines = this.#getContentLines(file);
        file.chunks=[];

        for (let i = 0; i <= lines.length-chunkSize; i++) {
            let chunk = lines.slice(i, i+chunkSize);
            file.chunks.push(chunk);
        }
        return file;
    }

    #chunkHash(chunk) {
        let content = chunk.map(line => line.content).join('\n');
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    #chunkMatch(first, second) {

        if (first.length != second.length) {
            return false;
        }

        for (let idx=0; idx < first.length; idx++) {
            if (!first[idx].equals(second[idx])) {
                return false;
            }
        }

        return true;
    }

    #filterCloneCandidates(file, compareFile) {
        let newInstances = [];
        let hashMap = new Map();

        for (let compareChunk of compareFile.chunks) {
            let hash = this.#chunkHash(compareChunk);

            if (!hashMap.has(hash)) {
                hashMap.set(hash, []);
            }

            hashMap.get(hash).push(compareChunk);
        }

        for (let chunk of file.chunks) {
            let hash = this.#chunkHash(chunk);
            let candidates = hashMap.get(hash) || [];

            for (let compareChunk of candidates) {
                if (this.#chunkMatch(chunk, compareChunk)) {
                    newInstances.push(
                        new Clone(
                            file.name,
                            compareFile.name,
                            chunk,
                            compareChunk
                        )
                    );
                }
            }
        }

        file.instances = file.instances || [];
        file.instances = file.instances.concat(newInstances);

        return file;
    }

    #expandCloneCandidates(file) {
        let expanded = [];

        for (let clone of file.instances) {
            let previous = expanded[expanded.length - 1];

            if (previous && previous.maybeExpandWith(clone)) {
                continue;
            }

            expanded.push(clone);
        }

        file.instances = expanded;

        return file;
    }

    #consolidateClones(file) {
        file.instances = file.instances.reduce((result, clone) => {
            let existing = result.find(c => c.equals(clone));

            if (existing) {
                existing.addTarget(clone);
            } else {
                result.push(clone);
            }

            return result;
        }, []);

        return file;
    }


    // Public Processing Steps
    // --------------------
    preprocess(file) {
        return new Promise( (resolve, reject) => {
            if (!file.name.endsWith('.java') ) {
                reject(file.name + ' is not a java file. Discarding.');
            } else if(this.#myFileStore.isFileProcessed(file.name)) {
                reject(file.name + ' has already been processed.');
            } else {
                resolve(file);
            }
        });
    }

    transform(file) {
        file = this.#filterLines(file);
        file = this.#chunkify(file);
        return file;
    }

    matchDetect(file) {
        let allFiles = this.#myFileStore.getAllFiles();
        file.instances = file.instances || [];
        for (let f of allFiles) {
            // TODO implement these methods (or re-write the function matchDetect() to your own liking)
            //
            // Overall process:
            //
            // 1. Find all equal chunks in file and f. Represent each matching pair as a Clone.
            //
            // 2. For each Clone with endLine=x, merge it with Clone with endLine-1=x
            //    remove the now redundant clone, rinse & repeat.
            //    note that you may end up with several "root" Clones for each processed file f
            //    if there are more than one clone between the file f and the current
            //
            // 3. If the same clone is found in several places, consolidate them into one Clone.
            //
            file = this.#filterCloneCandidates(file, f);
            file = this.#expandCloneCandidates(file);
            file = this.#consolidateClones(file);
        }

        return file;
    }

    pruneFile(file) {
        delete file.lines;
        delete file.instances;
        return file;
    }

    storeFile(file) {
        this.#myFileStore.storeFile(this.pruneFile(file));
        return file;
    }

    get numberOfProcessedFiles() { return this.#myFileStore.numberOfFiles; }
}

module.exports = CloneDetector;
