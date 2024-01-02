function getEventTarget() {
    'use strict';
    try {
        return new EventTarget();
    } catch (err) {
        const listeners = [];
        return {
            dispatchEvent(event) {
                listeners
                    .filter((listener) => listener.name === event.type)
                    .forEach((listener) => {
                        listener.handler(event);
                    });
            },
            addEventListener(name, handler) {
                listeners.push({ name, handler });
            },
        };
    }
}

export function buildEventSource() {
    'use strict';
    const eventTarget = getEventTarget();

    return {
        trigger(eventName, eventData) {
            const event = new Event(eventName);
            event.data = eventData;
            // console.log('EVENT', eventName, eventData);
            eventTarget.dispatchEvent(event);
        },
        on(eventName) {
            return {
                then(handler) {
                    eventTarget.addEventListener(eventName, handler);
                },
            };
        },
    };
}