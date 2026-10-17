function analyzeEmail(email) {

    const subject = email.subject || "";
    const body = email.body || "";
    const qrLinks = email.qrLinks || [];

    let tasks = [];
    let events = [];

    let sentences = body.split(/[.!?]\s+|\n+/);

    const taskWords =
        /\b(register|submit|complete|finish|sign up|fill out|pay|respond|rsvp|turn in)\b/i;

    const eventWords =
        /\b(meeting|competition|concert|workshop|event|practice|presentation|orientation)\b/i;

    const datePattern =
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?\b/i;

    const timePattern =
        /\b(1[0-2]|0?[1-9])(:[0-5]\d)?\s*(AM|PM)\b/i;

    for (let sentence of sentences) {

        sentence = sentence.trim();

        if (sentence === "") {
            continue;
        }

        const dateMatch = sentence.match(datePattern);

        const timeMatch = sentence.match(timePattern);

        let date = dateMatch ? dateMatch[0] : null;
        let time = timeMatch ? timeMatch[0] : null;

        const isTask = taskWords.test(sentence);

        if (isTask) {

            tasks.push({
                title: sentence,
                deadline: date
            });

        }

        if (eventWords.test(sentence) && date && !isTask) {

            events.push({
                title: sentence,
                date: date,
                time: time
            });

        }

    }

    return {

        summary: subject,

        tasks: tasks,

        events: events,

        qrLinks: qrLinks

    };

}