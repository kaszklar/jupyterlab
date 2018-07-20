import React from 'react';
import { TextItem } from '../component/text';

import { JupyterLabPlugin, JupyterLab } from '@jupyterlab/application';

import {
    IUploadModel,
    FileBrowserModel,
    IFileBrowserFactory,
    FileBrowser
} from '@jupyterlab/filebrowser';

import { IChangedArgs } from '@jupyterlab/coreutils';
import { ISignal } from '@phosphor/signaling';
import { IDisposable } from '@phosphor/disposable';
import { Token } from '@phosphor/coreutils';

import { ProgressBar } from '../component/progressBar';
import { VDomRenderer, InstanceTracker, VDomModel } from '@jupyterlab/apputils';
import { GroupItem } from '../component/group';
import { ArrayExt } from '@phosphor/algorithm';
import { IDefaultsManager } from './manager';

// tslint:disable-next-line:variable-name
const FileUploadComponent = (
    props: FileUploadComponent.IProps
): React.ReactElement<FileUploadComponent.IProps> => {
    return (
        <GroupItem>
            <TextItem source={'Uploading'} />
            <ProgressBar percentage={props.upload} />
        </GroupItem>
    );
};

namespace FileUploadComponent {
    export interface IProps {
        upload: number;
    }
}

class FileUpload extends VDomRenderer<FileUpload.Model> implements IFileUpload {
    constructor(opts: FileUpload.IOptions) {
        super();
        this._tracker = opts.tracker;
        this._tracker.currentChanged.connect(this._onBrowserChange);

        this.model = new FileUpload.Model(
            this._tracker.currentWidget && this._tracker.currentWidget.model
        );
    }

    render() {
        const uploadPaths = this.model!.paths;
        if (uploadPaths.length > 0) {
            return <FileUploadComponent upload={this.model!.progress[0]} />;
        } else {
            return <FileUploadComponent upload={100} />;
        }
    }

    private _onBrowserChange = (
        tracker: InstanceTracker<FileBrowser>,
        browser: FileBrowser | null
    ) => {
        if (browser === null) {
            this.model!.browserModel = null;
        } else {
            this.model!.browserModel = browser.model;
        }
    };

    private _tracker: InstanceTracker<FileBrowser>;
}

namespace FileUpload {
    export class Model extends VDomModel implements IFileUpload.IModel {
        constructor(browserModel: FileBrowserModel | null) {
            super();

            this.browserModel = browserModel;
        }

        get progress() {
            return this._progress;
        }

        get paths() {
            return this._paths;
        }

        get browserModel() {
            return this._browserModel;
        }

        set browserModel(browserModel: FileBrowserModel | null) {
            this._browserModel = browserModel;
            this._progress = Object.create(null);
            this._paths = [];

            if (this._browserModel !== null) {
                this._browserModel.uploadChanged.connect(this._uploadChanged);
            }

            this.stateChanged.emit(void 0);
        }

        private _uploadChanged = (
            browse: FileBrowserModel,
            uploads: IChangedArgs<IUploadModel>
        ) => {
            if (uploads.name === 'start' || uploads.name === 'update') {
                if (uploads.name === 'start') {
                    this._paths.push(uploads.newValue.path);
                }

                const idx = ArrayExt.findFirstIndex(
                    this._paths,
                    val => val === uploads.newValue.path
                );

                this._progress[idx] = uploads.newValue.progress * 100;
            } else if (uploads.name === 'finish') {
                const idx = ArrayExt.findFirstIndex(
                    this._paths,
                    val => val === uploads.oldValue.path
                );

                ArrayExt.removeAt(this._paths, idx);
                ArrayExt.removeAt(this._progress, idx);
            }

            this.stateChanged.emit(void 0);
        };

        private _progress: Array<number> = [];
        private _paths: Array<string> = [];
        private _browserModel: FileBrowserModel | null = null;
    }

    export interface IOptions {
        readonly tracker: InstanceTracker<FileBrowser>;
    }
}

export interface IFileUpload extends IDisposable {
    readonly model: IFileUpload.IModel | null;
    readonly modelChanged: ISignal<this, void>;
}

// tslint:disable-next-line:variable-name
export const IFileUpload = new Token<IFileUpload>(
    'jupyterlab-statusbar/IFileUpload'
);

export namespace IFileUpload {
    export interface IModel {
        readonly paths: Array<string>;
        readonly progress: Array<number>;
        readonly browserModel: FileBrowserModel | null;
    }
}

export const fileUploadItem: JupyterLabPlugin<IFileUpload> = {
    id: 'jupyterlab-statusbar/default-items:file-upload',
    autoStart: true,
    provides: IFileUpload,
    requires: [IDefaultsManager, IFileBrowserFactory],
    activate: (
        app: JupyterLab,
        manager: IDefaultsManager,
        browser: IFileBrowserFactory
    ) => {
        const item = new FileUpload({
            tracker: browser.tracker
        });

        manager.addDefaultStatus('file-upload-item', item, {
            align: 'middle',
            isActive: () => {
                return !!item.model && item.model.paths.length > 0;
            },
            stateChanged: item.model!.stateChanged
        });

        return item;
    }
};
