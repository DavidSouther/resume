CREATE TABLE doorlog (
    eventid bigint PRIMARY KEY,
    doorid integer NOT NULL CHECK (doorid > 0),
    tim timestamp NOT NULL,
    username text NOT NULL,
    event char(1) NOT NULL CHECK (event IN ('E', 'X'))
);
