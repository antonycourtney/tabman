import * as Constants from './components/constants';
import ChromePromise from 'chrome-promise';
import { initGlobalLogger, log } from './globals';
import { initState, loadSnapState, readSnapStateStr } from './state';
import * as actions from './actions';
import { mutableGet } from 'oneref';
import * as utils from './utils';

const chromep = ChromePromise;

/*
 * show the popout window in response to a show popout command
 *
 * Reads the latest snapshot of window state, and either sends focus to existing
 * popout or opens a new one.
 */
/*
 * This was a weird, bad dup of actions.showPopout.
 * We should no longer need this now that 
async function showPopout() {
    // first, check for existence of session state -- if it exists, we're already running
    const stateRef = await loadSnapState();
    if (stateRef == null) {
        console.log(
            'showPopout: no snap state found, creating popout window...',
        );
        chromep.windows.create({
            url: 'popout.html',
            type: 'popup',
            left: 0,
            top: 0,
            width: Constants.POPOUT_DEFAULT_WIDTH,
            height: Constants.POPOUT_DEFAULT_HEIGHT,
        });
        return;
    }
    const st = mutableGet(stateRef);
    console.log(
        'bgHelper: showPopout: before syncChromeWindows: st.popoutWindowId: ',
        st.popoutWindowId,
    );
    await actions.syncChromeWindows(stateRef);
    const st2 = mutableGet(stateRef);
    console.log(
        'bgHelper: showPopout: after syncChromeWindows: st.popoutWindowId: ',
        st2.popoutWindowId,
    );

    actions.showPopout(stateRef);
}
*/

async function main() {
    console.log('*** bgHelper: started at ', new Date().toString());
    initGlobalLogger('bgHelper');
    utils.setLogLevel(log);
    const userPrefs = await actions.readPreferences();
    console.log('bgHelper: Read userPrefs: ', userPrefs.toJS());

    // Check for existence of snap state -- if it exists, we're already running
    const snapStateStr = await readSnapStateStr();

    // initalLoad will be set to true the very first time bgHelper is loaded in a Chrome session:
    const initialLoad = snapStateStr == null;
    log.debug('bgHelper: initialLoad: ', initialLoad);

    // 8/23/24: Passing false for now to avoid horrid race condition when opening saved windows.
    // Means that popout window Id will often be wrong.
    const stateRef = await initState(false);

    log.debug('bgHelper: initialized stateRef');

    /*
    if (initialLoad && userPrefs.popoutOnStart) {
        log.debug('bgHelper: popoutOnStart is true, creating popout');
        actions.showPopout(stateRef);
    } else {
        log.debug('bgHelper: skipping popout');
    }
    */

    // Allows users to open the side panel by clicking on the action toolbar icon
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => log.error(error));

    chrome.commands.onCommand.addListener((command) => {
        log.debug('Chrome Event: onCommand: ', command);

        if (command === 'show_popout') {
            actions.showPopout(stateRef);
        }
    });
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        log.debug('bgHelper: Received message:', message);
        if (message.action === 'showPopout') {
            actions.showPopout(stateRef);
        }
        if (message.action === 'hidePopout') {
            actions.hidePopout(stateRef);
        }
        if (message.action === 'getPopoutWindowId') {
            const appState = mutableGet(stateRef);
            sendResponse({
                windowId: appState.popoutWindowId,
            });
        }
        return false;
    });

    // Use a port to track popout window
    chrome.runtime.onConnect.addListener((port) => {
        log.debug('bgHelper: onConnect: ', port, ' name: ', port.name);
        port.onMessage.addListener((message, port) => {
            return true;
        });
        port.onDisconnect.addListener(() => {
            log.debug('bgHelper: port disconnected: ');
        });
    });
}

main();
