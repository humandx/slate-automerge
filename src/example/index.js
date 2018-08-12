import SimpleApp from './simple/App';
import SocketApp from './socket/App';
import React from 'react';
import ReactDOM from 'react-dom';

class Selector extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            tab: 0
        }
    }

    render = () => {
        const Component = this.state.tab == 0 ? SimpleApp : SocketApp;
        return (
            <div>
                <div>
                    <button
                        onClick={() => {this.setState({tab: 0})}}
                    >
                        Simple
                    </button>
                    <button
                        onClick={() => {this.setState({tab: 1})}}
                    >
                        Socket
                    </button>
                </div>
                <Component />
            </div>
        )
    }
}

export default Selector
